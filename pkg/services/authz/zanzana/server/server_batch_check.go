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

	"github.com/grafana/grafana/pkg/services/authz/zanzana"
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
	release, err := s.acquireSlot("BatchCheck", r.GetNamespace())
	if err != nil {
		return nil, err
	}
	defer release()

	ctx, span := s.tracer.Start(ctx, "server.BatchCheck")
	defer span.End()
	span.SetAttributes(
		attribute.String("namespace", r.GetNamespace()),
		attribute.String("subject", r.GetSubject()),
		attribute.Int("check_count", len(r.GetChecks())),
	)

	start := time.Now()
	namespace := r.GetNamespace()
	checkCount := len(r.GetChecks())

	defer func() {
		duration := time.Since(start)
		s.metrics.requestDurationSeconds.WithLabelValues("BatchCheck").Observe(duration.Seconds())

		// Log slow batch checks for debugging (>1s is concerning)
		if duration > time.Second {
			s.logger.Debug("slow batch check detected",
				"namespace", namespace,
				"subject", r.GetSubject(),
				"check_count", checkCount,
				"duration_ms", duration.Milliseconds(),
			)
		}
	}()

	if err := s.mtReconciler.EnsureNamespace(ctx, namespace); err != nil {
		return nil, fmt.Errorf("failed to reconcile namespace: %w", err)
	}

	res, err := s.batchCheck(ctx, r, namespace)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		s.logger.Error("failed to perform batch check request", "error", err, "namespace", namespace)
		return nil, errors.New("failed to perform batch check request")
	}

	return res, nil
}

func (s *Server) batchCheck(ctx context.Context, r *authzv1.BatchCheckRequest, namespace string) (*authzv1.BatchCheckResponse, error) {
	if err := authorize(ctx, namespace, s.cfg); err != nil {
		return nil, err
	}

	checks := r.GetChecks()
	if len(checks) == 0 {
		return &authzv1.BatchCheckResponse{Results: make(map[string]*authzv1.BatchCheckResult)}, nil
	}

	if len(checks) > types.MaxBatchCheckItems {
		return nil, status.Errorf(grpccodes.InvalidArgument, "batch check exceeds maximum of %d items", types.MaxBatchCheckItems)
	}

	store, err := s.getStoreInfo(ctx, namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to get openfga store: %w", err)
	}

	contextuals, err := s.getContextuals(ctx, r.GetSubject())
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
	if err := s.runPhase(ctx, "group_resource", namespace, store, subject, items, contextuals, s.runGroupResourcePhase); err != nil {
		return nil, err
	}

	// Phase 2: Check folder permission inheritance (can_get, can_create, etc. on parent folder)
	// Example: user has "can_get" on folder-A → all dashboards in folder-A allowed
	if err := s.runPhase(ctx, "folder_permission", namespace, store, subject, items, contextuals, s.runFolderPermissionPhase); err != nil {
		return nil, err
	}

	// Phase 3: Check folder subresource access (folder_get, folder_create, etc.)
	// Example: user has "folder_get" on folder-A → dashboards in folder-A allowed via subresource
	if err := s.runPhase(ctx, "folder_subresource", namespace, store, subject, items, contextuals, s.runFolderSubresourcePhase); err != nil {
		return nil, err
	}

	// Phase 4: Check direct resource access
	// Example: user has "get" directly on dashboard-123
	if err := s.runPhase(ctx, "direct_resource", namespace, store, subject, items, contextuals, s.runDirectResourcePhase); err != nil {
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

// phaseFunc is a function type for batch check phases
type phaseFunc func(ctx context.Context, store *zanzana.StoreInfo, subject string, items map[string]*batchCheckItem, contextuals *openfgav1.ContextualTupleKeys) (itemsChecked int, err error)

// runPhase executes a batch check phase with tracing and metrics
func (s *Server) runPhase(ctx context.Context, phaseName string, namespace string, store *zanzana.StoreInfo, subject string, items map[string]*batchCheckItem, contextuals *openfgav1.ContextualTupleKeys, phase phaseFunc) error {
	ctx, span := s.tracer.Start(ctx, fmt.Sprintf("server.BatchCheck.%s", phaseName))
	defer span.End()

	start := time.Now()
	itemsChecked, err := phase(ctx, store, subject, items, contextuals)
	duration := time.Since(start)

	span.SetAttributes(
		attribute.String("phase", phaseName),
		attribute.String("namespace", namespace),
		attribute.Int64("duration_ms", duration.Milliseconds()),
		attribute.Int("items_checked", itemsChecked),
	)

	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
	}

	s.metrics.batchCheckPhaseDurationSeconds.WithLabelValues(phaseName).Observe(duration.Seconds())

	// Log slow phases for debugging (>300ms is concerning)
	if duration > 300*time.Millisecond {
		s.logger.Debug("slow batch check phase detected",
			"phase", phaseName,
			"namespace", namespace,
			"duration_ms", duration.Milliseconds(),
			"items_checked", itemsChecked,
			"store_id", store.ID,
		)
	}

	return err
}

// runGroupResourcePhase checks if the user has access at the group resource level.
// This is the broadest permission - if granted, access to all resources of that type is allowed.
func (s *Server) runGroupResourcePhase(
	ctx context.Context,
	store *zanzana.StoreInfo,
	subject string,
	items map[string]*batchCheckItem,
	contextuals *openfgav1.ContextualTupleKeys,
) (int, error) {
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
			CorrelationId: checkID,
		})
	}

	if len(checks) == 0 {
		return 0, nil
	}

	results, err := s.doBatchCheck(ctx, store, checks, contextuals)
	if err != nil {
		return len(checks), err
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

	return len(checks), nil
}

// folderCheckEntry is one OpenFGA folder tuple check (relation + folder object + context).
type folderCheckEntry struct {
	correlationID string
	relation      string
	folderIdent   string
	groupResource string
	resource      common.ResourceInfo
}

func collectFolderPermissionChecks(items map[string]*batchCheckItem) []folderCheckEntry {
	var entries []folderCheckEntry
	for _, item := range items {
		if item.resolved || !item.resource.IsGeneric() {
			continue
		}
		folderIdent := item.resource.FolderIdent()
		if folderIdent == "" {
			continue
		}
		if !isFolderPermissionBasedResource(item.resource.GroupResource()) {
			continue
		}
		relation := common.FolderPermissionRelation(item.relation)
		entries = append(entries, folderCheckEntry{
			correlationID: item.correlationID,
			relation:      relation,
			folderIdent:   folderIdent,
			groupResource: item.resource.GroupResource(),
			resource:      item.resource,
		})
	}
	return entries
}

func collectFolderSubresourceChecks(items map[string]*batchCheckItem) []folderCheckEntry {
	var entries []folderCheckEntry
	for _, item := range items {
		if item.resolved || !item.resource.IsGeneric() {
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
		for _, relation := range expandedSubresourcePermissionRelations(folderRelation) {
			entries = append(entries, folderCheckEntry{
				correlationID: item.correlationID,
				relation:      relation,
				folderIdent:   folderIdent,
				groupResource: item.resource.GroupResource(),
				resource:      item.resource,
			})
		}
	}
	return entries
}

// folderDedupKey identifies a unique OpenFGA folder check after deduplication.
type folderDedupKey struct {
	relation      string
	folderIdent   string
	groupResource string
}

func uniqueFolderCheckCount(entries []folderCheckEntry) int {
	if len(entries) == 0 {
		return 0
	}
	seen := make(map[folderDedupKey]struct{}, len(entries))
	for _, e := range entries {
		seen[folderDedupKey{relation: e.relation, folderIdent: e.folderIdent, groupResource: e.groupResource}] = struct{}{}
	}
	return len(seen)
}

// resolveFolderChecks runs folder permission or subresource checks, using BatchCheck when the
// number of unique folder tuples is small and ListObjects when it exceeds FolderCheckBatchThreshold.
func (s *Server) resolveFolderChecks(
	ctx context.Context,
	store *zanzana.StoreInfo,
	subject string,
	items map[string]*batchCheckItem,
	entries []folderCheckEntry,
	contextuals *openfgav1.ContextualTupleKeys,
) (int, error) {
	if len(entries) == 0 {
		return 0, nil
	}
	if uniqueFolderCheckCount(entries) > s.getFolderCheckBatchThreshold() {
		return s.resolveFolderChecksByList(ctx, store, subject, items, entries, contextuals)
	}
	return s.resolveFolderChecksByBatch(ctx, store, subject, items, entries, contextuals)
}

func (s *Server) getFolderCheckBatchThreshold() int {
	if s.cfg.FolderCheckBatchThreshold > 0 {
		return s.cfg.FolderCheckBatchThreshold
	}
	return 20
}

func (s *Server) resolveFolderChecksByList(
	ctx context.Context,
	store *zanzana.StoreInfo,
	subject string,
	items map[string]*batchCheckItem,
	entries []folderCheckEntry,
	contextuals *openfgav1.ContextualTupleKeys,
) (int, error) {
	type listGroupKey struct {
		relation      string
		groupResource string
	}
	groups := make(map[listGroupKey][]folderCheckEntry)
	for _, e := range entries {
		k := listGroupKey{relation: e.relation, groupResource: e.groupResource}
		groups[k] = append(groups[k], e)
	}

	unique := uniqueFolderCheckCount(entries)

	for key, groupEntries := range groups {
		sample := groupEntries[0]
		allowed := make(map[string]bool)
		if err := s.collectAllowedObjects(ctx, allowed, &openfgav1.ListObjectsRequest{
			StoreId:              store.ID,
			AuthorizationModelId: store.ModelID,
			Type:                 common.TypeFolder,
			Relation:             key.relation,
			User:                 subject,
			Context:              sample.resource.Context(),
		}, contextuals); err != nil {
			return unique, err
		}
		for _, e := range groupEntries {
			if !allowed[e.folderIdent] {
				continue
			}
			item := items[e.correlationID]
			if item.allowed {
				continue
			}
			item.allowed = true
			item.resolved = true
			item.err = ""
		}
	}

	return unique, nil
}

// --- Dedup batcher (BatchCheck path): groups identical OpenFGA folder checks so each unique
// (relation, folder, context) tuple is only checked once. ---

type dedupGroup struct {
	check          *openfgav1.BatchCheckItem
	correlationIDs []string
}

type dedupBatcher struct {
	groups []dedupGroup
	seen   map[folderDedupKey]int // key → index into groups
}

func newDedupBatcher() *dedupBatcher {
	return &dedupBatcher{seen: make(map[folderDedupKey]int)}
}

// add registers a correlation ID for a folder check identified by key.
// If the key has been seen before, the correlation ID is appended to the
// existing group and the check is discarded. Otherwise the check is stored
// and assigned a unique internal correlation ID.
func (b *dedupBatcher) add(key folderDedupKey, correlationID string, check *openfgav1.BatchCheckItem) {
	if idx, ok := b.seen[key]; ok {
		b.groups[idx].correlationIDs = append(b.groups[idx].correlationIDs, correlationID)
		return
	}
	check.CorrelationId = fmt.Sprintf("dedup_%d", len(b.groups))
	b.seen[key] = len(b.groups)
	b.groups = append(b.groups, dedupGroup{
		check:          check,
		correlationIDs: []string{correlationID},
	})
}

func (b *dedupBatcher) checks() []*openfgav1.BatchCheckItem {
	out := make([]*openfgav1.BatchCheckItem, len(b.groups))
	for i := range b.groups {
		out[i] = b.groups[i].check
	}
	return out
}

// resolve fans out OpenFGA results to all batch items that share each check.
// A correlation ID may appear in multiple groups (e.g. subresource expansion);
// if ANY group returns allowed the item is allowed. Items that only received
// errors are resolved with the first error.
func (b *dedupBatcher) resolve(results map[string]*openfgav1.BatchCheckSingleResult, items map[string]*batchCheckItem) {
	for i := range b.groups {
		g := &b.groups[i]
		result, ok := results[g.check.CorrelationId]
		if !ok {
			continue
		}
		for _, cid := range g.correlationIDs {
			item := items[cid]
			if item.allowed {
				continue
			}
			if result.GetAllowed() {
				item.allowed = true
				item.resolved = true
				item.err = ""
			} else if err := result.GetError(); err != nil && item.err == "" {
				item.err = err.GetMessage()
			}
		}
	}

	for i := range b.groups {
		for _, cid := range b.groups[i].correlationIDs {
			item := items[cid]
			if !item.resolved && item.err != "" {
				item.resolved = true
			}
		}
	}
}

func (s *Server) resolveFolderChecksByBatch(
	ctx context.Context,
	store *zanzana.StoreInfo,
	subject string,
	items map[string]*batchCheckItem,
	entries []folderCheckEntry,
	contextuals *openfgav1.ContextualTupleKeys,
) (int, error) {
	batcher := newDedupBatcher()
	for _, e := range entries {
		key := folderDedupKey{relation: e.relation, folderIdent: e.folderIdent, groupResource: e.groupResource}
		batcher.add(key, e.correlationID, &openfgav1.BatchCheckItem{
			TupleKey: &openfgav1.CheckRequestTupleKey{
				User:     subject,
				Relation: e.relation,
				Object:   e.folderIdent,
			},
			Context: e.resource.Context(),
		})
	}

	checks := batcher.checks()
	if len(checks) == 0 {
		return 0, nil
	}

	results, err := s.doBatchCheck(ctx, store, checks, contextuals)
	if err != nil {
		return len(checks), err
	}

	batcher.resolve(results, items)
	return len(checks), nil
}

// runFolderPermissionPhase checks folder permission inheritance (e.g. can_get on a folder
// grants access to all dashboards in that folder). Identical folder checks are deduplicated.
func (s *Server) runFolderPermissionPhase(
	ctx context.Context,
	store *zanzana.StoreInfo,
	subject string,
	items map[string]*batchCheckItem,
	contextuals *openfgav1.ContextualTupleKeys,
) (int, error) {
	entries := collectFolderPermissionChecks(items)
	return s.resolveFolderChecks(ctx, store, subject, items, entries, contextuals)
}

// runFolderSubresourcePhase checks folder subresource access (e.g. folder_get, folder_set_edit).
// Each item may expand into multiple relations; identical checks are deduplicated, and an item
// is allowed if ANY of its expanded checks returns allowed.
func (s *Server) runFolderSubresourcePhase(
	ctx context.Context,
	store *zanzana.StoreInfo,
	subject string,
	items map[string]*batchCheckItem,
	contextuals *openfgav1.ContextualTupleKeys,
) (int, error) {
	entries := collectFolderSubresourceChecks(items)
	return s.resolveFolderChecks(ctx, store, subject, items, entries, contextuals)
}

func expandedSubresourcePermissionRelations(relation string) []string {
	switch relation {
	case common.RelationSubresourceGet:
		return []string{
			common.RelationSubresourceGet,
			common.RelationSubresourceSetView,
			common.RelationSubresourceSetEdit,
			common.RelationSubresourceSetAdmin,
		}
	case common.RelationSubresourceCreate:
		return []string{
			common.RelationSubresourceCreate,
			common.RelationSubresourceSetEdit,
			common.RelationSubresourceSetAdmin,
		}
	case common.RelationSubresourceUpdate:
		return []string{
			common.RelationSubresourceUpdate,
			common.RelationSubresourceSetEdit,
			common.RelationSubresourceSetAdmin,
		}
	case common.RelationSubresourceDelete:
		return []string{
			common.RelationSubresourceDelete,
			common.RelationSubresourceSetEdit,
			common.RelationSubresourceSetAdmin,
		}
	case common.RelationSubresourceGetPermissions:
		return []string{
			common.RelationSubresourceGetPermissions,
			common.RelationSubresourceSetAdmin,
		}
	case common.RelationSubresourceSetPermissions:
		return []string{
			common.RelationSubresourceSetPermissions,
			common.RelationSubresourceSetAdmin,
		}
	default:
		return []string{relation}
	}
}

// runDirectResourcePhase resolves unresolved items via ListObjects instead of
// per-item Check calls. Most users have direct access to a small number of
// resources, so listing them all and doing set-membership lookups is cheaper
// than issuing one Check per batch item (where denials are expensive).
func (s *Server) runDirectResourcePhase(
	ctx context.Context,
	store *zanzana.StoreInfo,
	subject string,
	items map[string]*batchCheckItem,
	contextuals *openfgav1.ContextualTupleKeys,
) (int, error) {
	// Collect unresolved items, grouped by type.
	var genericItems, typedItems []*batchCheckItem
	for _, item := range items {
		if item.resolved {
			continue
		}
		if item.resource.IsGeneric() {
			genericItems = append(genericItems, item)
		} else {
			typedItems = append(typedItems, item)
		}
	}

	itemsChecked := len(genericItems) + len(typedItems)
	if itemsChecked == 0 {
		return 0, nil
	}

	if err := s.resolveGenericItems(ctx, store, subject, genericItems, contextuals); err != nil {
		return itemsChecked, err
	}
	if err := s.resolveTypedItems(ctx, store, subject, typedItems, contextuals); err != nil {
		return itemsChecked, err
	}

	// Mark all remaining unresolved items as resolved (denied)
	for _, item := range items {
		if !item.resolved {
			item.resolved = true
		}
	}

	return itemsChecked, nil
}

// resolveGenericItems enumerates generic resources the user has direct access
// to, then resolves items by set membership.
// Folder-based access is already resolved by earlier phases.
func (s *Server) resolveGenericItems(
	ctx context.Context,
	store *zanzana.StoreInfo,
	subject string,
	items []*batchCheckItem,
	contextuals *openfgav1.ContextualTupleKeys,
) error {
	type listKey struct {
		relation      string
		groupResource string
	}
	groups := make(map[listKey][]*batchCheckItem)
	for _, item := range items {
		key := listKey{relation: item.relation, groupResource: item.resource.GroupResource()}
		groups[key] = append(groups[key], item)
	}

	for key, groupItems := range groups {
		sample := groupItems[0]
		allowed := make(map[string]bool)

		if sample.resource.IsValidRelation(key.relation) {
			if err := s.collectAllowedObjects(ctx, allowed, &openfgav1.ListObjectsRequest{
				StoreId:              store.ID,
				AuthorizationModelId: store.ModelID,
				Type:                 common.TypeResource,
				Relation:             key.relation,
				User:                 subject,
				Context:              sample.resource.Context(),
			}, contextuals); err != nil {
				return err
			}
		}

		resolveByMembership(groupItems, allowed)
	}

	return nil
}

// resolveTypedItems enumerates typed resources (folders, teams, users, etc.)
// the user has access to, then resolves by set membership.
func (s *Server) resolveTypedItems(
	ctx context.Context,
	store *zanzana.StoreInfo,
	subject string,
	items []*batchCheckItem,
	contextuals *openfgav1.ContextualTupleKeys,
) error {
	type listKey struct {
		relation string
		typ      string
	}
	groups := make(map[listKey][]*batchCheckItem)
	for _, item := range items {
		key := listKey{relation: item.relation, typ: item.resource.Type()}
		groups[key] = append(groups[key], item)
	}

	for key, groupItems := range groups {
		sample := groupItems[0]
		allowed := make(map[string]bool)

		subresourceRelation := common.SubresourceRelation(key.relation)
		if sample.resource.HasSubresource() && sample.resource.IsValidRelation(subresourceRelation) {
			if err := s.collectAllowedObjects(ctx, allowed, &openfgav1.ListObjectsRequest{
				StoreId:              store.ID,
				AuthorizationModelId: store.ModelID,
				Type:                 key.typ,
				Relation:             common.SubresourcePermissionRelation(subresourceRelation),
				User:                 subject,
				Context:              sample.resource.Context(),
			}, contextuals); err != nil {
				return err
			}
		}

		if sample.resource.IsValidRelation(key.relation) {
			listRelation := key.relation
			if key.typ == common.TypeFolder {
				listRelation = common.FolderPermissionRelation(key.relation)
			}
			if err := s.collectAllowedObjects(ctx, allowed, &openfgav1.ListObjectsRequest{
				StoreId:              store.ID,
				AuthorizationModelId: store.ModelID,
				Type:                 key.typ,
				Relation:             listRelation,
				User:                 subject,
			}, contextuals); err != nil {
				return err
			}
		}

		resolveByMembership(groupItems, allowed)
	}

	return nil
}

// collectAllowedObjects calls ListObjects and adds the results to the allowed set.
func (s *Server) collectAllowedObjects(
	ctx context.Context,
	allowed map[string]bool,
	req *openfgav1.ListObjectsRequest,
	contextuals *openfgav1.ContextualTupleKeys,
) error {
	res, err := s.listObjects(ctx, req, contextuals)
	if err != nil {
		return err
	}
	for _, obj := range res.GetObjects() {
		allowed[obj] = true
	}
	return nil
}

func resolveByMembership(items []*batchCheckItem, allowed map[string]bool) {
	for _, item := range items {
		if ident := item.resource.ResourceIdent(); ident != "" && allowed[ident] {
			item.allowed = true
			item.resolved = true
		}
	}
}

func (s *Server) doBatchCheck(
	ctx context.Context,
	store *zanzana.StoreInfo,
	checks []*openfgav1.BatchCheckItem,
	contextuals *openfgav1.ContextualTupleKeys,
) (map[string]*openfgav1.BatchCheckSingleResult, error) {
	if len(checks) == 0 {
		return nil, nil
	}
	for _, check := range checks {
		if check != nil {
			check.ContextualTuples = contextuals
		}
	}
	return s.doOpenFGABatchCheck(ctx, store, checks)
}

// doOpenFGABatchCheck executes a batch check against OpenFGA, splitting into
// sub-batches if the number of checks exceeds the configured MaxChecksPerBatchCheck limit.
func (s *Server) doOpenFGABatchCheck(
	ctx context.Context,
	store *zanzana.StoreInfo,
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
	store *zanzana.StoreInfo,
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
