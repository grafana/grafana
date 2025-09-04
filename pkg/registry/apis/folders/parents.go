package folders

import (
	"context"
	"fmt"
	"slices"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/registry/rest"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	folderLegacy "github.com/grafana/grafana/pkg/services/folder"
)

type parentsGetter = func(ctx context.Context, folder *folders.Folder) (*folders.FolderInfoList, error)

func newParentsGetter(getter rest.Getter, maxDepth int) parentsGetter {
	return func(ctx context.Context, folder *folders.Folder) (*folders.FolderInfoList, error) {
		info := &folders.FolderInfoList{
			Items: []folders.FolderInfo{},
		}
		id := folder.Name
		if id == folderLegacy.GeneralFolderUID || id == folderLegacy.SharedWithMeFolderUID {
			info.Items = []folders.FolderInfo{{
				Name:  folder.Name,
				Title: folder.Spec.Title,
			}}
			return info, nil
		}

		found := make(map[string]bool)
		found[folder.Name] = true
		var err error

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

			if found[item.Parent] {
				return nil, fmt.Errorf("cyclic folder references found: %s", item.Parent)
			}

			obj, e2 := getter.Get(ctx, item.Parent, &metav1.GetOptions{})
			if e2 != nil {
				info.Items = append(info.Items, folders.FolderInfo{
					Name:        item.Parent,
					Detached:    true,
					Description: e2.Error(),
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

			if len(info.Items) >= maxDepth {
				err = folderLegacy.ErrMaximumDepthReached
				break
			}

			found[parentFolder.Name] = true
			folder = parentFolder
		}

		// Start from the root
		slices.Reverse(info.Items)
		return info, err
	}
}
