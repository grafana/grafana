package folders

import (
	"context"
	"fmt"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/registry/rest"
)

// getFolderParents gets a list of info objects for each parent of a Folder
// TODO: There are some other implementations that seem to do similar thing like pkg/services/folder/service.go#GetParents.
//
//	Not sure if they should be merged somehow or not.
func getFolderParents(ctx context.Context, folderGetter rest.Getter, folder *folders.Folder) *folders.FolderInfoList {
	info := &folders.FolderInfoList{
		Items: []folders.FolderInfo{},
	}
	for folder != nil {
		parent := getParent(folder)
		descr := ""
		if folder.Spec.Description != nil {
			descr = *folder.Spec.Description
		}
		info.Items = append(info.Items, folders.FolderInfo{
			Name:        folder.Name,
			Title:       folder.Spec.Title,
			Description: descr,
			Parent:      parent,
		})
		if parent == "" {
			break
		}

		obj, err := folderGetter.Get(ctx, parent, &metav1.GetOptions{})
		if err != nil {
			info.Items = append(info.Items, folders.FolderInfo{
				Name:        parent,
				Detached:    true,
				Description: err.Error(),
			})
			break
		}

		parentFolder, ok := obj.(*folders.Folder)
		if !ok {
			info.Items = append(info.Items, folders.FolderInfo{
				Name:        parent,
				Detached:    true,
				Description: fmt.Sprintf("expected folder, found: %T", obj),
			})
			break
		}
		folder = parentFolder
	}
	return info
}
