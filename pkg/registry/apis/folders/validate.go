package folders

import (
	"context"
	"fmt"
	"slices"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/registry/rest"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
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

	parents, err := getter(ctx, f)
	if err != nil {
		return fmt.Errorf("unable to create folder inside parent: %w", err)
	}

	// Can not create a folder that will be too deep
	if len(parents.Items)+1 > maxDepth {
		return fmt.Errorf("folder max depth exceeded, max depth is %d", maxDepth)
	}

	return nil
}

func validateOnUpdate(ctx context.Context,
	obj *folders.Folder,
	old *folders.Folder,
	getter rest.Getter,
	parents parentsGetter,
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

	//FIXME: until we have a way to represent the tree, we can only
	// look at folder parents to check how deep the new folder tree will be
	info, err := parents(ctx, parent)
	if err != nil {
		return err
	}

	// if by moving a folder we exceed the max depth, return an error
	if len(info.Items)+1 >= maxDepth {
		return folder.ErrMaximumDepthReached
	}
	return nil
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

	for _, v := range resp.Stats {
		if v.Count > 0 {
			return folder.ErrFolderNotEmpty
		}
	}
	return nil
}
