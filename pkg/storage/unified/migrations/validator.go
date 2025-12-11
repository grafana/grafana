package migrations

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/xorm"
	"k8s.io/apimachinery/pkg/runtime/schema"
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
	name        string
	client      resourcepb.ResourceIndexClient
	resource    schema.GroupResource
	table       string
	whereClause string
	driverName  string
}

func NewCountValidator(
	client resourcepb.ResourceIndexClient,
	resource schema.GroupResource,
	table string,
	whereClause string,
	driverName string,
) Validator {
	return &CountValidator{
		name:        "CountValidator",
		client:      client,
		resource:    resource,
		table:       table,
		whereClause: whereClause,
		driverName:  driverName,
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

	legacyCount, err := sess.Table(v.table).Where(v.whereClause, orgID).Count()
	if err != nil {
		return fmt.Errorf("failed to count %s: %w", v.table, err)
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

func NewFolderTreeValidator(
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

func (v *FolderTreeValidator) buildUnifiedFolderParentMap(ctx context.Context, namespace string, log log.Logger) (map[string]string, error) {
	// Search for all folders in this namespace
	searchResp, err := v.client.Search(ctx, &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: namespace,
				Group:     v.resource.Group,
				Resource:  v.resource.Resource,
			},
		},
		Limit: 100000, // Large limit to get all folders
	})
	if err != nil {
		return nil, fmt.Errorf("failed to search folders in unified storage: %w", err)
	}

	if searchResp.Results == nil {
		return make(map[string]string), nil
	}

	parentMap := make(map[string]string)
	for _, row := range searchResp.Results.Rows {
		if row.Key == nil {
			continue
		}

		folderUID := row.Key.Name
		parentUID := ""

		folderColIdx := -1
		for i, col := range searchResp.Results.Columns {
			if col.Name == "folder" {
				folderColIdx = i
				break
			}
		}

		if folderColIdx >= 0 && folderColIdx < len(row.Cells) {
			parentUID = string(row.Cells[folderColIdx])
		}

		parentMap[folderUID] = parentUID
	}

	log.Debug("Built unified folder parent map",
		"folder_count", len(parentMap),
		"namespace", namespace)

	return parentMap, nil
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
