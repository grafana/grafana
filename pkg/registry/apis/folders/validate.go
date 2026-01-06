package folders

import (
	"context"
	"fmt"
	"slices"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/registry/rest"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util"
)

func validateOnCreate(ctx context.Context, f *folders.Folder, getter parentsGetter, maxDepth int) error {
	id := f.Name

	if slices.Contains([]string{
		folder.GeneralFolderUID,
		folder.SharedWithMeFolderUID,
	}, id) {
		return dashboards.ErrFolderInvalidUID
	}

	meta, err := utils.MetaAccessor(f)
	if err != nil {
		return fmt.Errorf("unable to read metadata from object: %w", err)
	}

	if !util.IsValidShortUID(id) {
		return dashboards.ErrDashboardInvalidUid
	}

	if util.IsShortUIDTooLong(id) {
		return dashboards.ErrDashboardUidTooLong
	}

	if f.Spec.Title == "" {
		return dashboards.ErrFolderTitleEmpty
	}

	parentName := meta.GetFolder()
	if parentName == "" {
		return nil // OK, we do not need to validate the tree
	}

	if parentName == f.Name {
		return folder.ErrFolderCannotBeParentOfItself
	}

	// note: `parents` will include itself as the last item
	parents, err := getter(ctx, f)
	if err != nil {
		return fmt.Errorf("unable to create folder inside parent: %w", err)
	}

	// Can not create a folder that will be too deep.
	// We need to add +1 as we also have the root folder as part of the parents.
	if len(parents.Items) > maxDepth+1 {
		return fmt.Errorf("folder max depth exceeded, max depth is %d", maxDepth)
	}

	return nil
}

func validateOnUpdate(ctx context.Context,
	obj *folders.Folder,
	old *folders.Folder,
	getter rest.Getter,
	parents parentsGetter,
	searcher resourcepb.ResourceIndexClient,
	maxDepth int,
) error {
	folderObj, err := utils.MetaAccessor(obj)
	if err != nil {
		return err
	}
	oldFolder, err := utils.MetaAccessor(old)
	if err != nil {
		return err
	}

	if obj.Spec.Title == "" {
		return dashboards.ErrFolderTitleEmpty
	}

	if folderObj.GetFolder() == oldFolder.GetFolder() {
		return nil
	}

	// Validate the move operation
	newParent := folderObj.GetFolder()

	// If we move to root, we don't need to validate the depth, because the folder already existed
	// before and wasn't too deep. This move will make it more shallow.
	//
	// We also don't need to validate circular references because the root folder cannot have a parent.
	if newParent == folder.RootFolderUID {
		return nil
	}

	// folder cannot be moved to a k6 folder
	if newParent == accesscontrol.K6FolderUID {
		return fmt.Errorf("k6 project may not be moved")
	}

	parentObj, err := getter.Get(ctx, newParent, &metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("move target not found %w", err)
	}
	parent, ok := parentObj.(*folders.Folder)
	if !ok {
		return fmt.Errorf("expected folder, found %T", parentObj)
	}
	info, err := parents(ctx, parent)
	if err != nil {
		return err
	}

	// Check that the folder being moved is not an ancestor of the target parent.
	// This prevents circular references (e.g., moving A under B when B is already under A).
	for _, ancestor := range info.Items {
		if ancestor.Name == obj.Name {
			return fmt.Errorf("cannot move folder under its own descendant, this would create a circular reference")
		}
	}

	// if by moving a folder we exceed the max depth just from its parents + itself, return an error
	if len(info.Items) > maxDepth+1 {
		return folder.ErrMaximumDepthReached.Errorf("maximum folder depth reached")
	}
	// To try to save some computation, get the parents of the old parent (this is typically cheaper
	// than looking at the children of the folder). If the old parent has more parents or the same
	// number of parents as the new parent, we can return early, because we know the folder had to be
	// safe from the creation validation. If we cannot access the older parent, we will continue to check the children.
	if canSkipChildrenCheck(ctx, oldFolder, getter, parents, len(info.Items)) {
		return nil
	}

	// Now comes the more expensive part: we need to check if moving this folder will cause
	// any descendant folders to exceed the max depth.
	//
	// Calculate the maximum allowed subtree depth after the move.
	allowedDepth := (maxDepth + 1) - len(info.Items)
	if allowedDepth <= 0 {
		return nil
	}

	return checkSubtreeDepth(ctx, searcher, obj.Namespace, obj.Name, allowedDepth, maxDepth)
}

// canSkipChildrenCheck determines if we can skip the expensive children depth check.
// If the old parent depth is >= the new parent depth, the folder was already valid
// and this move won't make descendants exceed max depth.
func canSkipChildrenCheck(ctx context.Context, oldFolder utils.GrafanaMetaAccessor, getter rest.Getter, parents parentsGetter, newParentDepth int) bool {
	if oldFolder.GetFolder() == folder.RootFolderUID {
		return false
	}

	oldParentObj, err := getter.Get(ctx, oldFolder.GetFolder(), &metav1.GetOptions{})
	if err != nil {
		return false
	}

	oldParent, ok := oldParentObj.(*folders.Folder)
	if !ok {
		return false
	}

	oldInfo, err := parents(ctx, oldParent)
	if err != nil {
		return false
	}

	oldParentDepth := len(oldInfo.Items)
	levelDifference := newParentDepth - oldParentDepth
	return levelDifference <= 0
}

// checkSubtreeDepth uses a hybrid DFS+batching approach:
// 1. fetches one page of children for the current folder(s)
// 2. batches all those children into one request to get their children
// 3. continues depth-first (batching still) until max depth or violation
// 4. only fetches more siblings after fully exploring current batch
func checkSubtreeDepth(ctx context.Context, searcher resourcepb.ResourceIndexClient, namespace string, folderUID string, remainingDepth int, maxDepth int) error {
	if remainingDepth <= 0 {
		return nil
	}

	// Start with the folder being moved
	return checkSubtreeDepthBatched(ctx, searcher, namespace, []string{folderUID}, remainingDepth, maxDepth)
}

// checkSubtreeDepthBatched checks depth for a batch of folders at the same level
func checkSubtreeDepthBatched(ctx context.Context, searcher resourcepb.ResourceIndexClient, namespace string, parentUIDs []string, remainingDepth int, maxDepth int) error {
	if remainingDepth <= 0 || len(parentUIDs) == 0 {
		return nil
	}

	const pageSize int64 = 1000
	var offset int64
	totalPages := 0
	hasMore := true

	// Using an upper limit to ensure no infinite loops can happen
	for hasMore && totalPages < 1000 {
		totalPages++

		var err error
		var children []string
		children, hasMore, err = getChildrenBatch(ctx, searcher, namespace, parentUIDs, pageSize, offset)
		if err != nil {
			return fmt.Errorf("failed to get children: %w", err)
		}

		if len(children) == 0 {
			return nil
		}

		// if we are at the last allowed depth and children exist, we will hit the max
		if remainingDepth == 1 {
			return folder.ErrMaximumDepthReached.Errorf("maximum folder depth %d would be exceeded after move", maxDepth)
		}

		if err := checkSubtreeDepthBatched(ctx, searcher, namespace, children, remainingDepth-1, maxDepth); err != nil {
			return err
		}

		if !hasMore {
			return nil
		}

		offset += pageSize
	}

	return nil
}

// getChildrenBatch fetches children for multiple parents
func getChildrenBatch(ctx context.Context, searcher resourcepb.ResourceIndexClient, namespace string, parentUIDs []string, limit int64, offset int64) ([]string, bool, error) {
	if len(parentUIDs) == 0 {
		return nil, false, nil
	}

	resp, err := searcher.Search(ctx, &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: namespace,
				Group:     folders.FolderResourceInfo.GroupVersionResource().Group,
				Resource:  folders.FolderResourceInfo.GroupVersionResource().Resource,
			},
			Fields: []*resourcepb.Requirement{{
				Key:      resource.SEARCH_FIELD_FOLDER,
				Operator: string(selection.In),
				Values:   parentUIDs,
			}},
		},
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, false, fmt.Errorf("failed to search folders: %w", err)
	}

	if resp.Error != nil {
		return nil, false, fmt.Errorf("search error: %s", resp.Error.Message)
	}

	if resp.Results == nil || len(resp.Results.Rows) == 0 {
		return nil, false, nil
	}

	children := make([]string, 0, len(resp.Results.Rows))
	for _, row := range resp.Results.Rows {
		if row.Key != nil {
			children = append(children, row.Key.Name)
		}
	}

	hasMore := resp.Results.NextPageToken != ""
	return children, hasMore, nil
}

func validateOnDelete(ctx context.Context,
	f *folders.Folder,
	searcher resourcepb.ResourceIndexClient,
) error {
	resp, err := searcher.GetStats(ctx, &resourcepb.ResourceStatsRequest{Namespace: f.Namespace, Folder: f.Name})
	if err != nil {
		return err
	}

	if resp != nil && resp.Error != nil {
		return fmt.Errorf("could not verify if folder is empty: %v", resp.Error)
	}

	if resp.Stats == nil {
		return fmt.Errorf("could not verify if folder is empty: %v", resp.Error)
	}

	allowedResourceTypes := []string{"alertrules", "dashboards", "library_elements", "folders"}

	for _, v := range resp.Stats {
		if slices.Contains(allowedResourceTypes, v.Resource) && v.Count > 0 {
			return folder.ErrFolderNotEmpty.Errorf("folder is not empty, contains %d %s", v.Count, v.Resource)
		}
	}
	return nil
}
