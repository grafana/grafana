package folders

import (
	"context"
	"fmt"
	"strings"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	utils2 "github.com/grafana/grafana/pkg/registry/apis/preferences/utils" // TODO, will be moved into utils
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

	name, ok := utils2.ParseOwnerFromName(id)
	if ok {
		if name.Owner == utils2.NamespaceResourceOwner {
			return fmt.Errorf("folder may not be a namespace")
		}
		if meta.GetFolder() != "" {
			return fmt.Errorf("%s folder must be a root", name.Owner)
		}

		// Make sure a team/root
		refs := meta.GetOwnerReferences()
		switch len(refs) {
		case 0:
			return fmt.Errorf("folder is missing owner reference (%s)", id)
		case 1: // OK
		default:
			return fmt.Errorf("folder has multiple owner references (%s)", id)
		}
		ref := refs[0]
		if ref.Name != name.Name {
			return fmt.Errorf("owner reference must match the same name")
		}
		if strings.ToLower(ref.Kind) != string(name.Owner) {
			return fmt.Errorf("owner reference kind must match the name")
		}

		// The title will be based on the team/user so we should not save a value in the folder
		if f.Spec.Title != "" {
			return fmt.Errorf("folder title must be empty when creating a %s folder", name.Owner)
		}
		return nil
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
