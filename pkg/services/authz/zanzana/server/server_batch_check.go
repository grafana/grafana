package server

import (
	"context"
	"errors"
	"fmt"
	"time"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	serverconfig "github.com/openfga/openfga/pkg/server/config"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	grpccodes "google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

// batchCheckItem tracks the state of a single authz batch item through the check phases
type batchCheckItem struct {
	correlationID string
	resource      common.ResourceInfo
	relation      string
	// Final result state
	allowed  bool
	resolved bool
	err      string
}

func (s *Server) BatchCheck(ctx context.Context, r *authzv1.BatchCheckRequest) (*authzv1.BatchCheckResponse, error) {
	ctx, span := s.tracer.Start(ctx, "server.BatchCheck")
	defer span.End()
	span.SetAttributes(
		attribute.String("namespace", r.GetNamespace()),
		attribute.String("subject", r.GetSubject()),
		attribute.Int("check_count", len(r.GetChecks())),
	)

	defer func(t time.Time) {
		s.metrics.requestDurationSeconds.WithLabelValues("BatchCheck").Observe(time.Since(t).Seconds())
	}(time.Now())

	res, err := s.batchCheck(ctx, r)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		s.logger.Error("failed to perform batch check request", "error", err, "namespace", r.GetNamespace())
		return nil, errors.New("failed to perform batch check request")
	}

	return res, nil
}

func (s *Server) batchCheck(ctx context.Context, r *authzv1.BatchCheckRequest) (*authzv1.BatchCheckResponse, error) {
	if err := authorize(ctx, r.GetNamespace(), s.cfg); err != nil {
		return nil, err
	}

	checks := r.GetChecks()
	if len(checks) == 0 {
		return &authzv1.BatchCheckResponse{Results: make(map[string]*authzv1.BatchCheckResult)}, nil
	}

	if len(checks) > types.MaxBatchCheckItems {
		return nil, status.Errorf(grpccodes.InvalidArgument, "batch check exceeds maximum of %d items", types.MaxBatchCheckItems)
	}

	store, err := s.getStoreInfo(ctx, r.GetNamespace())
	if err != nil {
		return nil, fmt.Errorf("failed to get openfga store: %w", err)
	}

	contextuals, err := s.getContextuals(r.GetSubject())
	if err != nil {
		return nil, fmt.Errorf("failed to get contextual tuples: %w", err)
	}

	subject := r.GetSubject()

	// Initialize batch check items
	items := make(map[string]*batchCheckItem, len(checks))
	for _, item := range checks {
		relation := common.VerbMapping[item.GetVerb()]
		resource := common.NewResourceInfoFromBatchCheckItem(item)
		items[item.GetCorrelationId()] = &batchCheckItem{
			correlationID: item.GetCorrelationId(),
			resource:      resource,
			relation:      relation,
		}
	}

	// Phase 1: Check GroupResource access (broadest permissions)
	// Example: user has "get" on "dashboards" group_resource → all dashboards allowed
	if err := s.runGroupResourcePhase(ctx, store, subject, items, contextuals); err != nil {
		return nil, err
	}

	// Phase 2: Check folder permission inheritance (can_get, can_create, etc. on parent folder)
	// Example: user has "can_get" on folder-A → all dashboards in folder-A allowed
	if err := s.runFolderPermissionPhase(ctx, store, subject, items, contextuals); err != nil {
		return nil, err
	}

	// Phase 3: Check folder subresource access (folder_get, folder_create, etc.)
	// Example: user has "folder_get" on folder-A → dashboards in folder-A allowed via subresource
	if err := s.runFolderSubresourcePhase(ctx, store, subject, items, contextuals); err != nil {
		return nil, err
	}

	// Phase 4: Check direct resource access
	// Example: user has "get" directly on dashboard-123
	if err := s.runDirectResourcePhase(ctx, store, subject, items, contextuals); err != nil {
		return nil, err
	}

	// Build final results
	results := make(map[string]*authzv1.BatchCheckResult, len(items))
	for correlationID, item := range items {
		result := &authzv1.BatchCheckResult{Allowed: item.allowed}
		if item.err != "" {
			result.Error = item.err
		}
		results[correlationID] = result
	}

	return &authzv1.BatchCheckResponse{Results: results}, nil
}

// runGroupResourcePhase checks if the user has access at the group resource level.
// This is the broadest permission - if granted, access to all resources of that type is allowed.
func (s *Server) runGroupResourcePhase(
	ctx context.Context,
	store *storeInfo,
	subject string,
	items map[string]*batchCheckItem,
	contextuals *openfgav1.ContextualTupleKeys,
) error {
	checks := make([]*openfgav1.BatchCheckItem, 0, len(items))
	checkIDToCorrelation := make(map[string]string, len(items))

	for _, item := range items {
		if item.resolved {
			continue
		}

		// Only check group resource for valid group resource relations
		if !common.IsGroupResourceRelation(item.relation) {
			continue
		}

		checkID := fmt.Sprintf("%s_gr", item.correlationID)
		checkIDToCorrelation[checkID] = item.correlationID
		checks = append(checks, &openfgav1.BatchCheckItem{
			TupleKey: &openfgav1.CheckRequestTupleKey{
				User:     subject,
				Relation: item.relation,
				Object:   item.resource.GroupResourceIdent(),
			},
			ContextualTuples: contextuals,
			CorrelationId:    checkID,
		})
	}

	if len(checks) == 0 {
		return nil
	}

	results, err := s.doBatchCheck(ctx, store, checks)
	if err != nil {
		return err
	}

	// Process results
	for checkID, result := range results {
		correlationID := checkIDToCorrelation[checkID]
		item := items[correlationID]

		if err := result.GetError(); err != nil {
			item.err = err.GetMessage()
			item.resolved = true
		} else if result.GetAllowed() {
			item.allowed = true
			item.resolved = true
		}
	}

	return nil
}

// runFolderPermissionPhase checks folder permission inheritance.
// This applies to generic resources that support folder-based permissions (like dashboards).
func (s *Server) runFolderPermissionPhase(
	ctx context.Context,
	store *storeInfo,
	subject string,
	items map[string]*batchCheckItem,
	contextuals *openfgav1.ContextualTupleKeys,
) error {
	checks := make([]*openfgav1.BatchCheckItem, 0, len(items))
	checkIDToCorrelation := make(map[string]string, len(items))

	for _, item := range items {
		if item.resolved {
			continue
		}

		// Only applies to generic resources with folder support
		if !item.resource.IsGeneric() {
			continue
		}

		folderIdent := item.resource.FolderIdent()
		if folderIdent == "" {
			continue
		}

		// Only check folder permission for resources that inherit folder permissions
		if !isFolderPermissionBasedResource(item.resource.GroupResource()) {
			continue
		}

		folderCheckRelation := common.FolderPermissionRelation(item.relation)
		checkID := fmt.Sprintf("%s_fp", item.correlationID)
		checkIDToCorrelation[checkID] = item.correlationID
		checks = append(checks, &openfgav1.BatchCheckItem{
			TupleKey: &openfgav1.CheckRequestTupleKey{
				User:     subject,
				Relation: folderCheckRelation,
				Object:   folderIdent,
			},
			ContextualTuples: contextuals,
			Context:          item.resource.Context(),
			CorrelationId:    checkID,
		})
	}

	if len(checks) == 0 {
		return nil
	}

	results, err := s.doBatchCheck(ctx, store, checks)
	if err != nil {
		return err
	}

	// Process results
	for checkID, result := range results {
		correlationID := checkIDToCorrelation[checkID]
		item := items[correlationID]

		if err := result.GetError(); err != nil {
			item.err = err.GetMessage()
			item.resolved = true
		} else if result.GetAllowed() {
			item.allowed = true
			item.resolved = true
		}
	}

	return nil
}

// runFolderSubresourcePhase checks folder subresource access.
// This handles cases where access is granted via folder subresource relations.
func (s *Server) runFolderSubresourcePhase(
	ctx context.Context,
	store *storeInfo,
	subject string,
	items map[string]*batchCheckItem,
	contextuals *openfgav1.ContextualTupleKeys,
) error {
	checks := make([]*openfgav1.BatchCheckItem, 0, len(items))
	checkIDToCorrelation := make(map[string]string, len(items))

	for _, item := range items {
		if item.resolved {
			continue
		}

		// Only applies to generic resources
		if !item.resource.IsGeneric() {
			continue
		}

		folderIdent := item.resource.FolderIdent()
		if folderIdent == "" {
			continue
		}

		folderRelation := common.SubresourceRelation(item.relation)
		if !common.IsSubresourceRelation(folderRelation) {
			continue
		}

		checkID := fmt.Sprintf("%s_fs", item.correlationID)
		checkIDToCorrelation[checkID] = item.correlationID
		checks = append(checks, &openfgav1.BatchCheckItem{
			TupleKey: &openfgav1.CheckRequestTupleKey{
				User:     subject,
				Relation: folderRelation,
				Object:   folderIdent,
			},
			ContextualTuples: contextuals,
			Context:          item.resource.Context(),
			CorrelationId:    checkID,
		})
	}

	if len(checks) == 0 {
		return nil
	}

	results, err := s.doBatchCheck(ctx, store, checks)
	if err != nil {
		return err
	}

	// Process results
	for checkID, result := range results {
		correlationID := checkIDToCorrelation[checkID]
		item := items[correlationID]

		if err := result.GetError(); err != nil {
			item.err = err.GetMessage()
			item.resolved = true
		} else if result.GetAllowed() {
			item.allowed = true
			item.resolved = true
		}
	}

	return nil
}

// runDirectResourcePhase checks direct access to specific resources.
// This is the most granular check - access granted directly on the resource itself.
func (s *Server) runDirectResourcePhase(
	ctx context.Context,
	store *storeInfo,
	subject string,
	items map[string]*batchCheckItem,
	contextuals *openfgav1.ContextualTupleKeys,
) error {
	var checks []*openfgav1.BatchCheckItem
	checkIDToCorrelation := make(map[string]string)

	for _, item := range items {
		if item.resolved {
			continue
		}

		if item.resource.IsGeneric() {
			// Generic resource direct access
			resourceIdent := item.resource.ResourceIdent()
			if resourceIdent == "" || !item.resource.IsValidRelation(item.relation) {
				continue
			}

			checkID := fmt.Sprintf("%s_gd", item.correlationID)
			checkIDToCorrelation[checkID] = item.correlationID
			checks = append(checks, &openfgav1.BatchCheckItem{
				TupleKey: &openfgav1.CheckRequestTupleKey{
					User:     subject,
					Relation: item.relation,
					Object:   resourceIdent,
				},
				ContextualTuples: contextuals,
				Context:          item.resource.Context(),
				CorrelationId:    checkID,
			})
		} else {
			// Typed resource checks (subresource and direct)
			checks = s.addTypedResourceDirectChecks(checks, subject, item, contextuals, checkIDToCorrelation)
		}
	}

	if len(checks) == 0 {
		return nil
	}

	results, err := s.doBatchCheck(ctx, store, checks)
	if err != nil {
		return err
	}

	// Process results - for typed resources, we need to check both subresource and direct
	for checkID, result := range results {
		correlationID := checkIDToCorrelation[checkID]
		item := items[correlationID]

		// Skip if already resolved by another check in this phase
		if item.resolved {
			continue
		}

		if err := result.GetError(); err != nil {
			item.err = err.GetMessage()
			item.resolved = true
		} else if result.GetAllowed() {
			item.allowed = true
			item.resolved = true
		}
	}

	// Mark all remaining unresolved items as resolved (denied)
	for _, item := range items {
		if !item.resolved {
			item.resolved = true
		}
	}

	return nil
}

// addTypedResourceDirectChecks adds OpenFGA checks for typed resources (folder, team, user, etc.)
func (s *Server) addTypedResourceDirectChecks(
	checks []*openfgav1.BatchCheckItem,
	subject string,
	item *batchCheckItem,
	contextuals *openfgav1.ContextualTupleKeys,
	checkIDToCorrelation map[string]string,
) []*openfgav1.BatchCheckItem {
	resourceIdent := item.resource.ResourceIdent()
	resourceCtx := item.resource.Context()

	// Check subresource access if applicable
	subresourceRelation := common.SubresourceRelation(item.relation)
	if item.resource.HasSubresource() && item.resource.IsValidRelation(subresourceRelation) {
		checkID := fmt.Sprintf("%s_ts", item.correlationID)
		checkIDToCorrelation[checkID] = item.correlationID
		checks = append(checks, &openfgav1.BatchCheckItem{
			TupleKey: &openfgav1.CheckRequestTupleKey{
				User:     subject,
				Relation: subresourceRelation,
				Object:   resourceIdent,
			},
			ContextualTuples: contextuals,
			Context:          resourceCtx,
			CorrelationId:    checkID,
		})
	}

	// Check direct access to typed resource
	if resourceIdent != "" && item.resource.IsValidRelation(item.relation) {
		checkRelation := item.relation
		if item.resource.Type() == common.TypeFolder {
			checkRelation = common.FolderPermissionRelation(item.relation)
		}

		checkID := fmt.Sprintf("%s_td", item.correlationID)
		checkIDToCorrelation[checkID] = item.correlationID
		checks = append(checks, &openfgav1.BatchCheckItem{
			TupleKey: &openfgav1.CheckRequestTupleKey{
				User:     subject,
				Relation: checkRelation,
				Object:   resourceIdent,
			},
			ContextualTuples: contextuals,
			CorrelationId:    checkID,
		})
	}

	return checks
}

// doBatchCheck executes a batch check against OpenFGA, splitting into
// sub-batches if the number of checks exceeds the configured MaxChecksPerBatchCheck limit.
func (s *Server) doBatchCheck(
	ctx context.Context,
	store *storeInfo,
	checks []*openfgav1.BatchCheckItem,
) (map[string]*openfgav1.BatchCheckSingleResult, error) {
	if len(checks) == 0 {
		return nil, nil
	}

	maxChecks := s.getMaxChecksPerBatchCheck()

	// If within limit, send a single batch
	if len(checks) <= maxChecks {
		return s.executeBatchCheck(ctx, store, checks)
	}

	// Split into sub-batches
	allResults := make(map[string]*openfgav1.BatchCheckSingleResult, len(checks))
	for i := 0; i < len(checks); i += maxChecks {
		end := i + maxChecks
		if end > len(checks) {
			end = len(checks)
		}
		results, err := s.executeBatchCheck(ctx, store, checks[i:end])
		if err != nil {
			return nil, err
		}
		for k, v := range results {
			allResults[k] = v
		}
	}

	return allResults, nil
}

// executeBatchCheck sends a single OpenFGA BatchCheck request.
func (s *Server) executeBatchCheck(
	ctx context.Context,
	store *storeInfo,
	checks []*openfgav1.BatchCheckItem,
) (map[string]*openfgav1.BatchCheckSingleResult, error) {
	openfgaReq := &openfgav1.BatchCheckRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		Checks:               checks,
	}

	openfgaRes, err := s.openFGAClient.BatchCheck(ctx, openfgaReq)
	if err != nil {
		return nil, fmt.Errorf("failed to perform openfga batch check: %w", err)
	}

	return openfgaRes.GetResult(), nil
}

// getMaxChecksPerBatchCheck returns the configured maximum checks per batch,
// falling back to the default if not explicitly set.
func (s *Server) getMaxChecksPerBatchCheck() int {
	if s.cfg.OpenFgaServerSettings.MaxChecksPerBatchCheck > 0 {
		return int(s.cfg.OpenFgaServerSettings.MaxChecksPerBatchCheck)
	}
	return serverconfig.DefaultMaxChecksPerBatchCheck
}
