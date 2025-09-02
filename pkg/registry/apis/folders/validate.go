package folders

import (
	"context"
	"fmt"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils" // TODO, will be moved into utils
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/util"
)

func validateOnCreate(ctx context.Context, f *folders.Folder, getter parentsGetter, maxDepth int) error {
	id := f.Name

	for _, invalidName := range []string{
		folder.GeneralFolderUID,
		folder.SharedWithMeFolderUID,
	} {
		if id == invalidName {
			return dashboards.ErrFolderInvalidUID
		}
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
		return nil // No paren is set, so no need to check the tree
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
