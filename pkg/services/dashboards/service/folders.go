package service

import (
	"context"

	folderv0alpha1 "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"k8s.io/apimachinery/pkg/selection"
)

type folderSearch struct {
	namespace string
	k8sClient client.K8sHandler
}

type FolderLookup interface {
	GetFolders(ctx context.Context, query folder.GetFoldersQuery) ([]*folder.Folder, error)
}

func NewFolderLookup(namespace string, k8sClient client.K8sHandler) FolderLookup {
	return &folderSearch{
		namespace: namespace,
		k8sClient: k8sClient,
	}
}

// GetFolders implements the FolderLookup interface ( so does the folder service, so the implemenation be easily swapped )
func (fl *folderSearch) GetFolders(ctx context.Context, query folder.GetFoldersQuery) ([]*folder.Folder, error) {
	request := &resource.ResourceSearchRequest{
		Options: &resource.ListOptions{
			Fields: []*resource.Requirement{},
			Labels: []*resource.Requirement{},
		},
		Limit: 100000}

	request.Fields = []string{
		resource.SEARCH_FIELD_TITLE,
	}

	req := []*resource.Requirement{{
		Key:      resource.SEARCH_FIELD_NAME,
		Operator: string(selection.In),
		Values:   query.UIDs,
	}}
	request.Options.Fields = append(request.Options.Fields, req...)

	federate, err := resource.AsResourceKey(fl.namespace, folderv0alpha1.RESOURCE)
	if err != nil {
		return nil, err
	}
	request.Federated = []*resource.ResourceKey{federate}
	request.Options.Key, err = resource.AsResourceKey(fl.namespace, folderv0alpha1.RESOURCE)

	res, err := fl.k8sClient.Search(ctx, query.OrgID, request)
	if err != nil {
		return nil, err
	}

	folders := []*folder.Folder{}
	for _, item := range res.Results.Rows {
		key := item.Key
		f := &folder.Folder{
			UID:   key.Name,
			Title: string(item.Cells[0]),
		}
		folders = append(folders, f)
	}

	return folders, nil
}
