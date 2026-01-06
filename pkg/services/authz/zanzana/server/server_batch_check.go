package server

import (
	"context"
	"fmt"
	"time"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"google.golang.org/protobuf/types/known/structpb"

	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

// checkKey represents a unique check to be performed
type checkKey struct {
	relation string
	object   string
}

// batchCheckBuilder encapsulates state for building OpenFGA batch checks
type batchCheckBuilder struct {
	subject      string
	contextuals  *openfgav1.ContextualTupleKeys
	checks       []*openfgav1.BatchCheckItem
	checksSeen   map[checkKey]bool
	checkMapping map[string]checkKey
	counter      int
}

func newBatchCheckBuilder(subject string, contextuals *openfgav1.ContextualTupleKeys) *batchCheckBuilder {
	return &batchCheckBuilder{
		subject:      subject,
		contextuals:  contextuals,
		checks:       make([]*openfgav1.BatchCheckItem, 0),
		checksSeen:   make(map[checkKey]bool),
		checkMapping: make(map[string]checkKey),
		counter:      0,
	}
}

func (b *batchCheckBuilder) addCheck(relation, object string, context *structpb.Struct) {
	if object == "" {
		return
	}

	key := checkKey{relation: relation, object: object}
	if b.checksSeen[key] {
		return
	}
	b.checksSeen[key] = true

	correlationID := fmt.Sprintf("c%d", b.counter)
	b.counter++

	b.checks = append(b.checks, &openfgav1.BatchCheckItem{
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User:     b.subject,
			Relation: relation,
			Object:   object,
		},
		ContextualTuples: b.contextuals,
		Context:          context,
		CorrelationId:    correlationID,
	})
	b.checkMapping[correlationID] = key
}

// BatchCheck implements authzv1.AuthzServiceServer.BatchCheck
// This performs multiple access checks in a single request using OpenFGA's native BatchCheck API.
func (s *Server) BatchCheck(ctx context.Context, r *authzv1.BatchCheckRequest) (*authzv1.BatchCheckResponse, error) {
	ctx, span := s.tracer.Start(ctx, "server.BatchCheck")
	defer span.End()

	span.SetAttributes(attribute.Int("check_count", len(r.GetChecks())))

	defer func(t time.Time) {
		s.metrics.requestDurationSeconds.WithLabelValues("server.BatchCheck", "").Observe(time.Since(t).Seconds())
	}(time.Now())

	res, err := s.batchCheck(ctx, r)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		s.logger.Error("failed to perform batch check request", "error", err)
		return nil, fmt.Errorf("failed to perform batch check request: %w", err)
	}

	return res, nil
}

func (s *Server) batchCheck(ctx context.Context, r *authzv1.BatchCheckRequest) (*authzv1.BatchCheckResponse, error) {
	items := r.GetChecks()
	if len(items) == 0 {
		return &authzv1.BatchCheckResponse{
			Results: make(map[string]*authzv1.BatchCheckResult),
		}, nil
	}

	// Group items by namespace
	itemsByNamespace := make(map[string][]*authzv1.BatchCheckItem)
	for _, item := range items {
		ns := item.GetNamespace()
		itemsByNamespace[ns] = append(itemsByNamespace[ns], item)
	}

	// Authorize and get store info for each namespace
	stores := make(map[string]*storeInfo)
	for namespace := range itemsByNamespace {
		if err := authorize(ctx, namespace, s.cfg); err != nil {
			return nil, err
		}
		store, err := s.getStoreInfo(ctx, namespace)
		if err != nil {
			return nil, err
		}
		stores[namespace] = store
	}

	contextuals, err := s.getContextuals(r.GetSubject())
	if err != nil {
		return nil, err
	}

	results := make(map[string]*authzv1.BatchCheckResult, len(items))
	subject := r.GetSubject()

	// Process each namespace separately
	for namespace, nsItems := range itemsByNamespace {
		store := stores[namespace]

		// Phase 1: Check GroupResource access (broadest permissions)
		// Example: user has "get" on "dashboards" group_resource → all dashboards allowed
		s.runGroupResourcePhase(ctx, store, subject, nsItems, contextuals, results)

		// Phase 2: Check folder permission inheritance (can_get, can_create, etc. on parent folder)
		// Example: user has "can_get" on folder-A → all dashboards in folder-A allowed
		s.runFolderPermissionPhase(ctx, store, subject, nsItems, contextuals, results)

		// Phase 3: Check folder subresource access (folder_get, folder_create, etc.)
		// Example: user has "folder_get" on folder-A → dashboards in folder-A allowed via subresource
		s.runFolderSubresourcePhase(ctx, store, subject, nsItems, contextuals, results)

		// Phase 4: Check direct resource access
		// Example: user has "get" directly on dashboard-123
		s.runDirectResourcePhase(ctx, store, subject, nsItems, contextuals, results)
	}

	// Mark any remaining unresolved items as denied
	for _, item := range items {
		if _, resolved := results[item.GetCorrelationId()]; !resolved {
			results[item.GetCorrelationId()] = &authzv1.BatchCheckResult{Allowed: false}
		}
	}

	return s.buildResponse(results), nil
}

func (s *Server) buildResponse(results map[string]*authzv1.BatchCheckResult) *authzv1.BatchCheckResponse {
	return &authzv1.BatchCheckResponse{
		Results: results,
		Zookie:  &authzv1.Zookie{Timestamp: time.Now().UnixMilli()},
	}
}

// runGroupResourcePhase checks if the user has GroupResource-level access.
// This is the broadest permission - if allowed, all items in that group are allowed.
func (s *Server) runGroupResourcePhase(
	ctx context.Context,
	store *storeInfo,
	subject string,
	items []*authzv1.BatchCheckItem,
	contextuals *openfgav1.ContextualTupleKeys,
	results map[string]*authzv1.BatchCheckResult,
) {
	// Group items by their GroupResource
	type grInfo struct {
		relation string
		grIdent  string
		items    []string // correlation IDs
	}
	groupedItems := make(map[string]*grInfo) // groupResource -> info

	for _, item := range items {
		relation := common.VerbMapping[item.GetVerb()]
		if !common.IsGroupResourceRelation(relation) {
			continue
		}

		resource := common.NewResourceInfoFromBatchItem(item)
		gr := resource.GroupResource()

		if _, exists := groupedItems[gr]; !exists {
			groupedItems[gr] = &grInfo{
				relation: relation,
				grIdent:  resource.GroupResourceIdent(),
				items:    make([]string, 0),
			}
		}
		groupedItems[gr].items = append(groupedItems[gr].items, item.GetCorrelationId())
	}

	if len(groupedItems) == 0 {
		return
	}

	// Build batch check for unique GroupResources
	builder := newBatchCheckBuilder(subject, contextuals)
	grCheckMapping := make(map[string]string) // OpenFGA correlationID -> groupResource

	for gr, info := range groupedItems {
		correlationID := fmt.Sprintf("gr%d", builder.counter)
		builder.counter++
		builder.checks = append(builder.checks, &openfgav1.BatchCheckItem{
			TupleKey: &openfgav1.CheckRequestTupleKey{
				User:     subject,
				Relation: info.relation,
				Object:   info.grIdent,
			},
			ContextualTuples: contextuals,
			CorrelationId:    correlationID,
		})
		grCheckMapping[correlationID] = gr
	}

	openfgaRes, err := s.openfgaClient.BatchCheck(ctx, &openfgav1.BatchCheckRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		Checks:               builder.checks,
	})
	if err != nil {
		s.logger.Warn("Failed to check group resource access", "error", err)
		return
	}

	// Mark all items in allowed GroupResources
	for correlationID, result := range openfgaRes.GetResult() {
		gr := grCheckMapping[correlationID]
		if allowed, ok := result.GetCheckResult().(*openfgav1.BatchCheckSingleResult_Allowed); ok && allowed.Allowed {
			for _, itemCorrelationID := range groupedItems[gr].items {
				results[itemCorrelationID] = &authzv1.BatchCheckResult{Allowed: true}
			}
		}
	}
}

// runFolderPermissionPhase checks folder permission inheritance (can_get, can_create, etc.).
// This applies to folder-based resources like dashboards, panels, etc.
func (s *Server) runFolderPermissionPhase(
	ctx context.Context,
	store *storeInfo,
	subject string,
	items []*authzv1.BatchCheckItem,
	contextuals *openfgav1.ContextualTupleKeys,
	results map[string]*authzv1.BatchCheckResult,
) {
	builder := newBatchCheckBuilder(subject, contextuals)
	checkToItems := make(map[checkKey][]string) // checkKey -> correlation IDs

	for _, item := range items {
		if _, resolved := results[item.GetCorrelationId()]; resolved {
			continue
		}

		resource := common.NewResourceInfoFromBatchItem(item)
		folderIdent := resource.FolderIdent()

		// Only folder-based generic resources use folder permission inheritance
		if !resource.IsGeneric() || folderIdent == "" || !isFolderPermissionBasedResource(resource.GroupResource()) {
			continue
		}

		relation := common.VerbMapping[item.GetVerb()]
		rel := common.FolderPermissionRelation(relation)
		key := checkKey{relation: rel, object: folderIdent}
		checkToItems[key] = append(checkToItems[key], item.GetCorrelationId())
		builder.addCheck(rel, folderIdent, resource.Context())
	}

	if len(builder.checks) == 0 {
		return
	}

	checkResults, err := s.executeOpenFGABatchChecks(ctx, store, builder)
	if err != nil {
		s.logger.Warn("Failed folder permission phase", "error", err)
		return
	}

	// Mark items allowed by folder permissions
	for key, allowed := range checkResults {
		if allowed {
			for _, correlationID := range checkToItems[key] {
				results[correlationID] = &authzv1.BatchCheckResult{Allowed: true}
			}
		}
	}
}

// runFolderSubresourcePhase checks folder subresource access (folder_get, folder_create, etc.).
func (s *Server) runFolderSubresourcePhase(
	ctx context.Context,
	store *storeInfo,
	subject string,
	items []*authzv1.BatchCheckItem,
	contextuals *openfgav1.ContextualTupleKeys,
	results map[string]*authzv1.BatchCheckResult,
) {
	builder := newBatchCheckBuilder(subject, contextuals)
	checkToItems := make(map[checkKey][]string)

	for _, item := range items {
		if _, resolved := results[item.GetCorrelationId()]; resolved {
			continue
		}

		resource := common.NewResourceInfoFromBatchItem(item)
		relation := common.VerbMapping[item.GetVerb()]

		var objectIdent string
		var subresRel string

		if resource.IsGeneric() {
			// Generic resources: check subresource on folder
			folderIdent := resource.FolderIdent()
			if folderIdent == "" {
				continue
			}
			subresRel = common.SubresourceRelation(relation)
			if !common.IsSubresourceRelation(subresRel) {
				continue
			}
			objectIdent = folderIdent
		} else {
			// Typed resources: check subresource on the resource itself
			if !resource.HasSubresource() || !resource.IsValidRelation(relation) {
				continue
			}
			objectIdent = resource.ResourceIdent()
			if objectIdent == "" {
				continue
			}
			subresRel = common.SubresourceRelation(relation)
		}

		key := checkKey{relation: subresRel, object: objectIdent}
		checkToItems[key] = append(checkToItems[key], item.GetCorrelationId())
		builder.addCheck(subresRel, objectIdent, resource.Context())
	}

	if len(builder.checks) == 0 {
		return
	}

	checkResults, err := s.executeOpenFGABatchChecks(ctx, store, builder)
	if err != nil {
		s.logger.Warn("Failed folder subresource phase", "error", err)
		return
	}

	for key, allowed := range checkResults {
		if allowed {
			for _, correlationID := range checkToItems[key] {
				results[correlationID] = &authzv1.BatchCheckResult{Allowed: true}
			}
		}
	}
}

// runDirectResourcePhase checks direct resource access.
func (s *Server) runDirectResourcePhase(
	ctx context.Context,
	store *storeInfo,
	subject string,
	items []*authzv1.BatchCheckItem,
	contextuals *openfgav1.ContextualTupleKeys,
	results map[string]*authzv1.BatchCheckResult,
) {
	builder := newBatchCheckBuilder(subject, contextuals)
	checkToItems := make(map[checkKey][]string)

	for _, item := range items {
		if _, resolved := results[item.GetCorrelationId()]; resolved {
			continue
		}

		resource := common.NewResourceInfoFromBatchItem(item)
		relation := common.VerbMapping[item.GetVerb()]

		if !resource.IsValidRelation(relation) {
			continue
		}

		resourceIdent := resource.ResourceIdent()
		if resourceIdent == "" {
			continue
		}

		// For folders, use the computed permission relation
		checkRelation := relation
		if resource.Type() == common.TypeFolder {
			checkRelation = common.FolderPermissionRelation(relation)
		}

		key := checkKey{relation: checkRelation, object: resourceIdent}
		checkToItems[key] = append(checkToItems[key], item.GetCorrelationId())
		builder.addCheck(checkRelation, resourceIdent, resource.Context())
	}

	if len(builder.checks) == 0 {
		return
	}

	checkResults, err := s.executeOpenFGABatchChecks(ctx, store, builder)
	if err != nil {
		s.logger.Warn("Failed direct resource phase", "error", err)
		return
	}

	for key, allowed := range checkResults {
		if allowed {
			for _, correlationID := range checkToItems[key] {
				results[correlationID] = &authzv1.BatchCheckResult{Allowed: true}
			}
		}
	}
}

// executeOpenFGABatchChecks executes the OpenFGA batch checks in chunks and returns results
func (s *Server) executeOpenFGABatchChecks(ctx context.Context, store *storeInfo, builder *batchCheckBuilder) (map[checkKey]bool, error) {
	const maxChecksPerBatch = 50
	checkResults := make(map[checkKey]bool)

	for i := 0; i < len(builder.checks); i += maxChecksPerBatch {
		end := i + maxChecksPerBatch
		if end > len(builder.checks) {
			end = len(builder.checks)
		}

		openfgaRes, err := s.openfgaClient.BatchCheck(ctx, &openfgav1.BatchCheckRequest{
			StoreId:              store.ID,
			AuthorizationModelId: store.ModelID,
			Checks:               builder.checks[i:end],
		})
		if err != nil {
			return nil, fmt.Errorf("failed to perform OpenFGA batch check: %w", err)
		}

		// Process results
		for correlationID, result := range openfgaRes.GetResult() {
			key, ok := builder.checkMapping[correlationID]
			if !ok {
				continue
			}
			if allowed, ok := result.GetCheckResult().(*openfgav1.BatchCheckSingleResult_Allowed); ok {
				checkResults[key] = allowed.Allowed
			}
		}
	}

	return checkResults, nil
}
