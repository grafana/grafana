package migrations

import (
	"context"
	"fmt"
	"slices"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/xorm"
)

func filterResponse(response *resourcepb.BulkResponse, resources []schema.GroupResource) *resourcepb.BulkResponse {
	if len(resources) == 0 {
		return response
	}

	// Create a resource lookup map for efficient filtering
	resourceMap := make(map[string]bool)
	for _, res := range resources {
		key := fmt.Sprintf("%s/%s", res.Group, res.Resource)
		resourceMap[key] = true
	}

	// Filter summaries to only include matching resources
	var filteredSummaries []*resourcepb.BulkResponse_Summary
	for _, summary := range response.Summary {
		key := fmt.Sprintf("%s/%s", summary.Group, summary.Resource)
		if resourceMap[key] {
			filteredSummaries = append(filteredSummaries, summary)
		}
	}

	// Filter rejected items to only include matching resources
	var filteredRejected []*resourcepb.BulkResponse_Rejected
	for _, rejected := range response.Rejected {
		if rejected.Key != nil {
			key := fmt.Sprintf("%s/%s", rejected.Key.Group, rejected.Key.Resource)
			if resourceMap[key] {
				filteredRejected = append(filteredRejected, rejected)
			}
		}
	}

	// Create filtered response, preserving original processed count for percentage calculations
	return &resourcepb.BulkResponse{
		Error:     response.Error,
		Processed: response.Processed,
		Summary:   filteredSummaries,
		Rejected:  filteredRejected,
	}
}

type CountValidator struct {
	name       string
	client     resourcepb.ResourceIndexClient
	resource   schema.GroupResource
	opts       CountValidationOptions
	driverName string
}

func newCountValidator(
	client resourcepb.ResourceIndexClient,
	resource schema.GroupResource,
	opts CountValidationOptions,
	driverName string,
) Validator {
	return &CountValidator{
		name:       "CountValidator",
		client:     client,
		resource:   resource,
		opts:       opts,
		driverName: driverName,
	}
}

func (v *CountValidator) Name() string {
	return v.name
}

func (v *CountValidator) Validate(ctx context.Context, sess *xorm.Session, response *resourcepb.BulkResponse, log log.Logger) error {
	// Filter response to only include the configured resource
	response = filterResponse(response, []schema.GroupResource{v.resource})
	if len(response.Rejected) > 0 {
		log.Warn("Migration had rejected items", "count", len(response.Rejected))
		for i, rejected := range response.Rejected {
			if i < 10 { // Log first 10 rejected items
				log.Warn("Rejected item",
					"namespace", rejected.Key.Namespace,
					"group", rejected.Key.Group,
					"resource", rejected.Key.Resource,
					"name", rejected.Key.Name,
					"reason", rejected.Error)
			}
		}
		// Rejections are not fatal - they may be expected for invalid data
	}

	// Should have at most one summary after filtering
	if len(response.Summary) == 0 {
		log.Debug("No summaries found for resource, skipping count validation",
			"resource", fmt.Sprintf("%s.%s", v.resource.Resource, v.resource.Group))
		return nil
	}

	if len(response.Summary) > 1 {
		return fmt.Errorf("expected at most 1 summary after filtering, got %d", len(response.Summary))
	}

	summary := response.Summary[0]

	// Get legacy count from database
	orgID, err := ParseOrgIDFromNamespace(summary.Namespace)
	if err != nil {
		return fmt.Errorf("invalid namespace %s: %w", summary.Namespace, err)
	}

	counter := sess.Table(v.opts.Table).Where(v.opts.Where, orgID)
	if v.opts.Join != nil {
		counter = counter.Join("INNER", v.opts.Join.Table, v.opts.Join.On)
	}
	if v.opts.Distinct != "" {
		counter = counter.Distinct(v.opts.Distinct)
	}
	legacyCount, err := counter.Count()
	if err != nil {
		return fmt.Errorf("failed to count %s: %w", v.opts.Table, err)
	}

	var unifiedCount int64
	if v.driverName == migrator.SQLite {
		unifiedCount, err = sess.Table("resource").
			Where("namespace = ? AND `group` = ? AND resource = ?",
				summary.Namespace, summary.Group, summary.Resource).
			Count()
		if err != nil {
			return fmt.Errorf("failed to count resource table for %s/%s in namespace %s: %w",
				summary.Group, summary.Resource, summary.Namespace, err)
		}
	} else {
		// Get unified storage count using GetStats API
		statsResp, err := v.client.GetStats(ctx, &resourcepb.ResourceStatsRequest{
			Namespace: summary.Namespace,
			Kinds:     []string{fmt.Sprintf("%s/%s", summary.Group, summary.Resource)},
		})
		if err != nil {
			return fmt.Errorf("failed to get stats for %s/%s in namespace %s: %w",
				summary.Group, summary.Resource, summary.Namespace, err)
		}
		// Find the count for this specific resource type
		for _, stat := range statsResp.Stats {
			if stat.Group == summary.Group && stat.Resource == summary.Resource {
				unifiedCount = stat.Count
				break
			}
		}
	}

	// Account for rejected items in validation
	expectedCount := unifiedCount + int64(len(response.Rejected))

	log.Info("Count validation",
		"resource", fmt.Sprintf("%s.%s", summary.Resource, summary.Group),
		"namespace", summary.Namespace,
		"legacy_count", legacyCount,
		"unified_count", unifiedCount,
		"migration_summary_count", summary.Count,
		"rejected", len(response.Rejected),
		"history", summary.History)

	// Validate that we migrated all items (allowing for rejected items)
	if legacyCount > expectedCount {
		return fmt.Errorf("count mismatch for %s.%s in namespace %s: legacy has %d, unified has %d, rejected %d",
			summary.Resource, summary.Group, summary.Namespace,
			legacyCount, unifiedCount, len(response.Rejected))
	}

	return nil
}

type FolderTreeValidator struct {
	name       string
	client     resourcepb.ResourceIndexClient
	resource   schema.GroupResource
	driverName string
}

func newFolderTreeValidator(
	client resourcepb.ResourceIndexClient,
	resource schema.GroupResource,
	driverName string,
) Validator {
	return &FolderTreeValidator{
		name:       "FolderTreeValidator",
		client:     client,
		resource:   resource,
		driverName: driverName,
	}
}

type legacyFolder struct {
	ID        int64  `xorm:"id"`
	UID       string `xorm:"uid"`
	FolderUID string `xorm:"folder_uid"`
	Title     string `xorm:"title"`
}

type unifiedFolder struct {
	GUID   string `xorm:"guid"`
	Name   string `xorm:"name"`
	Folder string `xorm:"folder"`
}

func (v *FolderTreeValidator) Name() string {
	return v.name
}

func (v *FolderTreeValidator) Validate(ctx context.Context, sess *xorm.Session, response *resourcepb.BulkResponse, log log.Logger) error {
	// Filter response to only include the configured resource (folders)
	response = filterResponse(response, []schema.GroupResource{v.resource})

	// Should have at most one summary after filtering
	if len(response.Summary) == 0 {
		log.Debug("No summaries found for folders, skipping folder tree validation")
		return nil
	}

	if len(response.Summary) > 1 {
		return fmt.Errorf("expected at most 1 summary after filtering, got %d", len(response.Summary))
	}

	summary := response.Summary[0]

	// Get orgID from namespace
	orgID, err := ParseOrgIDFromNamespace(summary.Namespace)
	if err != nil {
		return fmt.Errorf("invalid namespace %s: %w", summary.Namespace, err)
	}

	// Build legacy folder parent map
	legacyParentMap, err := v.buildLegacyFolderParentMap(sess, orgID, log)
	if err != nil {
		return fmt.Errorf("failed to build legacy folder parent map: %w", err)
	}

	// Build unified storage folder parent map
	var unifiedParentMap map[string]string
	if v.driverName == migrator.SQLite {
		unifiedParentMap, err = v.buildUnifiedFolderParentMapSQLite(sess, summary.Namespace, log)
	} else {
		unifiedParentMap, err = v.buildUnifiedFolderParentMap(ctx, summary.Namespace, log)
	}
	if err != nil {
		return fmt.Errorf("failed to build unified folder parent map: %w", err)
	}

	// Compare the two maps
	mismatches := []string{}
	for uid, legacyParent := range legacyParentMap {
		unifiedParent, exists := unifiedParentMap[uid]
		if !exists {
			// Folder exists in legacy but not in unified - might be rejected, skip
			log.Debug("Folder exists in legacy but not in unified storage",
				"uid", uid,
				"legacy_parent", legacyParent)
			continue
		}

		if legacyParent != unifiedParent {
			mismatch := fmt.Sprintf("folder %s: legacy parent=%s, unified parent=%s",
				uid, legacyParent, unifiedParent)
			mismatches = append(mismatches, mismatch)
			log.Warn("Folder parent mismatch",
				"uid", uid,
				"legacy_parent", legacyParent,
				"unified_parent", unifiedParent)
		}
	}

	// Check for folders in unified but not in legacy (shouldn't happen)
	for uid := range unifiedParentMap {
		if _, exists := legacyParentMap[uid]; !exists {
			mismatch := fmt.Sprintf("folder %s exists in unified but not in legacy", uid)
			mismatches = append(mismatches, mismatch)
			log.Warn("Folder exists in unified but not in legacy", "uid", uid)
		}
	}

	if len(mismatches) > 0 {
		log.Error("Folder tree structure validation failed",
			"mismatch_count", len(mismatches),
			"total_legacy_folders", len(legacyParentMap),
			"total_unified_folders", len(unifiedParentMap))
		return fmt.Errorf("folder tree structure mismatch: %d folders have incorrect parents", len(mismatches))
	}

	log.Info("Folder tree structure validation passed",
		"folder_count", len(legacyParentMap),
		"namespace", summary.Namespace)

	return nil
}

func (v *FolderTreeValidator) buildLegacyFolderParentMap(sess *xorm.Session, orgID int64, log log.Logger) (map[string]string, error) {
	// Query all folders for this org
	var folders []legacyFolder
	err := sess.Table("dashboard").
		Cols("id", "uid", "folder_uid", "title").
		Where("org_id = ? AND is_folder = ?", orgID, true).
		Find(&folders)
	if err != nil {
		return nil, fmt.Errorf("failed to query legacy folders: %w", err)
	}

	parentMap := make(map[string]string)
	for _, folder := range folders {
		parentMap[folder.UID] = folder.FolderUID
	}

	if len(parentMap) == 0 {
		log.Debug("No legacy folders found for org", "org_id", orgID)
		return make(map[string]string), nil
	}

	log.Debug("Built legacy folder parent map",
		"folder_count", len(parentMap),
		"org_id", orgID)

	return parentMap, nil
}

// A variable so tests can page over a handful of folders.
var folderSearchPageSize int64 = 10000

func (v *FolderTreeValidator) buildUnifiedFolderParentMap(ctx context.Context, namespace string, log log.Logger) (map[string]string, error) {
	parentMap := make(map[string]string)

	// Paging with the cursor of the last row read, rather than with an offset,
	// because a folder created or deleted while we page shifts every offset after
	// it and would hide or duplicate folders.
	var cursor []string
	for page := 1; ; page++ {
		searchResp, err := v.client.Search(ctx, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: namespace,
					Group:     v.resource.Group,
					Resource:  v.resource.Resource,
				},
			},
			Limit:        folderSearchPageSize,
			SearchAfter:  cursor,
			Fields:       []string{resource.SEARCH_FIELD_FOLDER},
			ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to search folders in unified storage (page %d): %w", page, err)
		}
		if searchResp == nil {
			return nil, fmt.Errorf("failed to search folders in unified storage (page %d): empty response", page)
		}
		if searchResp.GetError() != nil {
			return nil, fmt.Errorf("failed to search folders in unified storage (page %d): %w", page, resource.GetError(searchResp.GetError()))
		}

		rows, err := decodeFolderRows(searchResp)
		if err != nil {
			return nil, fmt.Errorf("failed to decode folders from unified storage (page %d): %w", page, err)
		}
		for _, row := range rows {
			parentMap[row.name] = row.parent
		}

		// Only a full page can be followed by another one.
		if int64(len(rows)) < folderSearchPageSize {
			break
		}

		next := rows[len(rows)-1].cursor
		// Without a usable cursor the next request would repeat this page forever,
		// and the map built so far may be missing folders.
		if len(next) == 0 {
			return nil, fmt.Errorf("failed to page folders in unified storage: page %d of %d folders carries no pagination cursor", page, len(rows))
		}
		if slices.Equal(next, cursor) {
			return nil, fmt.Errorf("failed to page folders in unified storage: page %d did not move past cursor %v", page, cursor)
		}
		cursor = next
	}

	log.Debug("Built unified folder parent map",
		"folder_count", len(parentMap),
		"namespace", namespace)

	return parentMap, nil
}

type unifiedFolderRow struct {
	name   string
	parent string
	// Sort values of this row, passed back as SearchAfter to continue paging.
	cursor []string
}

func decodeFolderRows(response *resourcepb.ResourceSearchResponse) ([]unifiedFolderRow, error) {
	if response == nil {
		return nil, nil
	}

	switch response.GetResultFormat() {
	case resourcepb.ResourceSearchRequest_UNSPECIFIED, resourcepb.ResourceSearchRequest_RESOURCE_TABLE:
		table := response.GetResults()
		if table == nil {
			return nil, nil
		}
		folderColumn := -1
		for i, column := range table.GetColumns() {
			if column.GetName() == resource.SEARCH_FIELD_FOLDER {
				folderColumn = i
				break
			}
		}
		rows := make([]unifiedFolderRow, 0, len(table.GetRows()))
		for i, row := range table.GetRows() {
			if row == nil || row.GetKey() == nil {
				return nil, fmt.Errorf("row %d has no key", i)
			}
			parentUID := ""
			if folderColumn >= 0 && folderColumn < len(row.GetCells()) {
				parentUID = string(row.GetCells()[folderColumn])
			}
			rows = append(rows, unifiedFolderRow{
				name:   row.GetKey().GetName(),
				parent: parentUID,
				cursor: row.GetSortFields(),
			})
		}
		return rows, nil

	case resourcepb.ResourceSearchRequest_FIELD_VALUES:
		rows := make([]unifiedFolderRow, 0, len(response.GetRows()))
		for i, row := range response.GetRows() {
			if row == nil || row.GetKey() == nil {
				return nil, fmt.Errorf("row %d has no key", i)
			}
			values, err := resource.DecodeSearchValues(response.GetFields(), row)
			if err != nil {
				return nil, fmt.Errorf("row %d: %w", i, err)
			}
			parentUID := ""
			if value, ok := values[resource.SEARCH_FIELD_FOLDER]; ok {
				var valid bool
				parentUID, valid = value.(string)
				if !valid {
					return nil, fmt.Errorf("row %d field %q is not a string", i, resource.SEARCH_FIELD_FOLDER)
				}
			}
			rows = append(rows, unifiedFolderRow{
				name:   row.GetKey().GetName(),
				parent: parentUID,
				cursor: row.GetSortFields(),
			})
		}
		return rows, nil

	default:
		return nil, fmt.Errorf("unsupported search result format %d", response.GetResultFormat())
	}
}

func (v *FolderTreeValidator) buildUnifiedFolderParentMapSQLite(sess *xorm.Session, namespace string, log log.Logger) (map[string]string, error) {
	var folders []unifiedFolder
	err := sess.Table("resource").
		Cols("guid", "name", "folder").
		Where("namespace = ? AND resource = ?", namespace, "folder").
		Find(&folders)
	if err != nil {
		return nil, fmt.Errorf("failed to query unified folders: %w", err)
	}

	parentMap := make(map[string]string)
	for _, folder := range folders {
		parentMap[folder.Name] = folder.Folder
	}

	if len(parentMap) == 0 {
		log.Debug("No unified folders found for namespace", "namespace", namespace)
		return make(map[string]string), nil
	}

	log.Debug("Built unified folder parent map",
		"folder_count", len(parentMap),
		"namespace", namespace)

	return parentMap, nil
}

// CountValidationJoin configures an optional INNER JOIN for the legacy count query.
// Use []string{"tablename", "alias"} as Table to get dialect-correct quoting from xorm.
type CountValidationJoin struct {
	Table any    // passed directly to xorm Join(); use []string{"table", "alias"} for quoting
	On    string // JOIN condition, may use the alias
}

type CountValidationOptions struct {
	Table string
	// includes org_id
	Where    string
	Distinct string
	// Join optionally adds an INNER JOIN so the legacy count matches exactly what the
	// migrator processes (e.g. excluding orphaned rows whose foreign key was deleted).
	Join *CountValidationJoin
}

// CountValidation creates a ValidatorFactory for count-based validation.
// It compares the count of resources in the legacy table with unified storage.
func CountValidation(resource schema.GroupResource, opts CountValidationOptions) ValidatorFactory {
	return func(client resourcepb.ResourceIndexClient, driverName string) Validator {
		return newCountValidator(client, resource, opts, driverName)
	}
}

// FolderTreeValidation creates a ValidatorFactory for folder tree structure validation.
// It validates that folder parent relationships are preserved after migration.
func FolderTreeValidation(resource schema.GroupResource) ValidatorFactory {
	return func(client resourcepb.ResourceIndexClient, driverName string) Validator {
		return newFolderTreeValidator(client, resource, driverName)
	}
}
