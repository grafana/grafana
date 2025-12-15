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
	// safe from the creation validation.
	oldParentDepth := 0
	if oldFolder.GetFolder() != folder.RootFolderUID {
		oldParentObj, err := getter.Get(ctx, oldFolder.GetFolder(), &metav1.GetOptions{})
		if err != nil {
			return fmt.Errorf("old parent not found %w", err)
		}
		oldParent, ok := oldParentObj.(*folders.Folder)
		if !ok {
			return fmt.Errorf("expected folder, found %T", oldParentObj)
		}
		oldInfo, err := parents(ctx, oldParent)
		if err != nil {
			return err
		}
		oldParentDepth = len(oldInfo.Items)
	}
	levelDifference := len(info.Items) - oldParentDepth
	if levelDifference <= 0 {
		return nil
	}

	// Now comes the more expensive part: we need to check if moving this folder will cause
	// any descendant folders to exceed the max depth.
	//
	// Calculate the maximum allowed subtree depth after the move.
	// We only need to search one level beyond this to detect violations.
	depthToCheck := (maxDepth + 1) - len(info.Items)
	currentLevel := []string{obj.Name}
	for depth := 1; depth <= depthToCheck; depth++ {
		children, err := searchChildrenOfFolders(ctx, searcher, obj.Namespace, currentLevel)
		if err != nil {
			return fmt.Errorf("failed to get children for depth validation: %w", err)
		}

		if len(children) == 0 {
			break
		}

		// if descendants exist beyond the allowed depth, error
		if depth == depthToCheck {
			return folder.ErrMaximumDepthReached.Errorf("maximum folder depth %d would be exceeded after move", maxDepth)
		}

		currentLevel = children
	}

	return nil
}

// searchChildrenOfFolders returns all folder UIDs that have a parent in the given list.
func searchChildrenOfFolders(ctx context.Context, searcher resourcepb.ResourceIndexClient, namespace string, parentUIDs []string) ([]string, error) {
	if len(parentUIDs) == 0 {
		return nil, nil
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
		Limit: 10000,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to search folders: %w", err)
	}

	if resp.Error != nil {
		return nil, fmt.Errorf("search error: %s", resp.Error.Message)
	}

	if resp.Results == nil || len(resp.Results.Rows) == 0 {
		return nil, nil
	}

	children := make([]string, 0, len(resp.Results.Rows))
	for _, row := range resp.Results.Rows {
		if row.Key != nil {
			children = append(children, row.Key.Name)
		}
	}

	// TODO: handle continue tokens...

	return children, nil
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
