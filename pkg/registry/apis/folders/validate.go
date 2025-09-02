package folders

import (
	"context"
	"fmt"
	"slices"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/registry/rest"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	utils2 "github.com/grafana/grafana/pkg/registry/apis/preferences/utils" // TODO, will be moved into utils
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
		// "namespace" is not valid based on owner parsing
	}, id) {
		return dashboards.ErrFolderInvalidUID
	}

	meta, err := utils.MetaAccessor(f)
	if err != nil {
		return fmt.Errorf("unable to read metadata from object: %w", err)
	}

	name, ok := utils2.ParseOwnerFromName(id)
	if ok {
		if err = validateOwnerReference(name, meta); err != nil {
			return err
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

func validateOwnerReference(name utils2.OwnerReference, folder utils.GrafanaMetaAccessor) error {
	if name.Owner == utils2.NamespaceResourceOwner {
		return fmt.Errorf("folder may not be a namespace")
	}
	if folder.GetFolder() != "" {
		return fmt.Errorf("%s folder must be a root", name.Owner)
	}

	// Make sure a team/root
	refs := folder.GetOwnerReferences()
	switch len(refs) {
	case 0:
		return fmt.Errorf("folder is missing owner reference (%s)", name.Name)
	case 1: // OK
	default:
		return fmt.Errorf("folder has multiple owner references (%s)", name.Name)
	}
	ref := refs[0]
	if ref.Name != name.Name {
		return fmt.Errorf("owner reference must match the same name")
	}
	if strings.ToLower(ref.Kind) != string(name.Owner) {
		return fmt.Errorf("owner reference kind must match the name")
	}
	if !strings.HasPrefix(ref.APIVersion, "iam.grafana.app/") {
		return fmt.Errorf("owner reference should be iam.grafana.app")
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

	name, ok := utils2.ParseOwnerFromName(obj.Name)
	if ok {
		if err = validateOwnerReference(name, folderObj); err != nil {
			return err
		}

		// The title will be based on the team/user so we should not save a value in the folder
		if obj.Spec.Title != "" {
			return fmt.Errorf("folder title must be empty")
		}
		return nil
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
	if len(info.Items)+1 >= folderValidationRules.maxDepth {
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
