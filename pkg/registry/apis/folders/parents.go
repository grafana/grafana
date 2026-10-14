package folders

import (
	"context"
	"slices"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/registry/rest"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/tracing"
	folderLegacy "github.com/grafana/grafana/pkg/services/folder"
)

type parentsResult struct {
	Hierarchy *folders.FolderInfoList
	// LookupError records non-NotFound failures that leave a partial hierarchy.
	// Missing ancestors are represented only by Detached entries in Hierarchy.
	LookupError error
}

// parentsGetter returns an error only when no usable hierarchy exists, such as
// for cycles. Otherwise Hierarchy is non-nil, even when LookupError is set.
type parentsGetter = func(ctx context.Context, folder *folders.Folder) (parentsResult, error)

func newParentsGetter(getter rest.Getter, maxDepth int) parentsGetter {
	return func(ctx context.Context, folder *folders.Folder) (parentsResult, error) {
		ctx, span := tracer.Start(ctx, "folders.getParents")
		defer span.End()

		info := &folders.FolderInfoList{
			Items: []folders.FolderInfo{},
		}
		id := folder.Name
		if id == folderLegacy.GeneralFolderUID || id == folderLegacy.SharedWithMeFolderUID {
			info.Items = []folders.FolderInfo{{
				Name:  folder.Name,
				Title: folder.Spec.Title,
			}}
			return parentsResult{Hierarchy: info}, nil
		}

		found := make(map[string]bool)
		found[folder.Name] = true
		var lookupErr error

		for folder != nil {
			meta, _ := utils.MetaAccessor(folder)
			item := folders.FolderInfo{
				Name:   folder.Name,
				Title:  folder.Spec.Title,
				Parent: meta.GetFolder(),
			}
			if folder.Spec.Description != nil {
				item.Description = *folder.Spec.Description
			}
			info.Items = append(info.Items, item)
			if folderLegacy.IsRootFolderUID(item.Parent) {
				break
			}

			if found[item.Parent] {
				return parentsResult{}, tracing.Error(span, folderLegacy.ErrCyclicReference.Errorf("cyclic folder references found: %s", item.Parent))
			}

			obj, err := getter.Get(ctx, item.Parent, &metav1.GetOptions{})
			if err != nil {
				_ = tracing.Error(span, err)
				if !apierrors.IsNotFound(err) {
					lookupErr = err
				}
				info.Items = append(info.Items, folders.FolderInfo{
					Name:        item.Parent,
					Detached:    true,
					Description: err.Error(),
				})
				break
			}

			parentFolder, ok := obj.(*folders.Folder)
			if !ok {
				lookupErr = tracing.Errorf(span, "expected folder, found: %T", obj)
				info.Items = append(info.Items, folders.FolderInfo{
					Name:        item.Parent,
					Detached:    true,
					Description: lookupErr.Error(),
				})
				break
			}
			found[parentFolder.Name] = true
			folder = parentFolder
		}

		// Start from the root
		slices.Reverse(info.Items)
		return parentsResult{Hierarchy: info, LookupError: lookupErr}, nil
	}
}
