package folders

import (
	"context"
	"fmt"
	"slices"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/registry/rest"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/folder"
)

type parentsGetter = func(ctx context.Context, id string) (*folders.FolderInfoList, error)

func newParentsGetter(getter rest.Getter, maxDepth int) parentsGetter {
	return func(ctx context.Context, id string) (*folders.FolderInfoList, error) {
		info := &folders.FolderInfoList{
			Items: []folders.FolderInfo{},
		}
		if id == folder.GeneralFolderUID || id == folder.SharedWithMeFolderUID {
			return info, nil // empty items
		}

		obj, err := getter.Get(ctx, id, &metav1.GetOptions{})
		if err != nil {
			return nil, err
		}

		folder, ok := obj.(*folders.Folder)
		if !ok {
			return nil, fmt.Errorf("expecting folder, found: %T", obj)
		}
		found := make(map[string]bool)
		found[folder.Name] = true

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
			if item.Parent == "" {
				break
			}

			obj, err := getter.Get(ctx, item.Parent, &metav1.GetOptions{})
			if err != nil {
				info.Items = append(info.Items, folders.FolderInfo{
					Name:        item.Parent,
					Detached:    true,
					Description: err.Error(),
				})
				break
			}

			parentFolder, ok := obj.(*folders.Folder)
			if !ok {
				info.Items = append(info.Items, folders.FolderInfo{
					Name:        item.Parent,
					Detached:    true,
					Description: fmt.Sprintf("expected folder, found: %T", obj),
				})
				break
			}

			if found[parentFolder.Name] {
				return nil, fmt.Errorf("cyclic folder references found")
			}

			found[parentFolder.Name] = true
			folder = parentFolder
		}

		// Start from the root
		slices.Reverse(info.Items)
		return info, nil
	}
}
