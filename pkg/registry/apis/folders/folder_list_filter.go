package folders

import (
	"context"

	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	claims "github.com/grafana/authlib/types"
	sdkres "github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type folderListStorage struct {
	grafanarest.Storage
}

func newFolderListStorage(store grafanarest.Storage) grafanarest.Storage {
	base := &folderListStorage{Storage: store}
	watcher, hasWatch := store.(rest.Watcher)
	collectionDeleter, hasCollectionDelete := store.(rest.CollectionDeleter)
	// Current folder storage chains implement both optional interfaces or neither.
	if hasWatch && hasCollectionDelete {
		return &struct {
			*folderListStorage
			rest.Watcher
			rest.CollectionDeleter
		}{base, watcher, collectionDeleter}
	}
	return base
}

func (s *folderListStorage) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	obj, err := s.Storage.List(ctx, options)
	if err != nil {
		return nil, err
	}
	return filterK6FoldersFromList(ctx, obj), nil
}

func filterK6FoldersFromList(ctx context.Context, obj runtime.Object) runtime.Object {
	requester, _ := identity.GetRequester(ctx)
	if identity.IsServiceIdentity(ctx) || requester != nil && requester.IsIdentityType(claims.TypeServiceAccount) {
		return obj
	}

	list, ok := obj.(sdkres.ListObject)
	if !ok {
		return obj
	}

	items := list.GetItems()
	visible := make([]sdkres.Object, 0, len(items))
	for _, item := range items {
		if item.GetName() == accesscontrol.K6FolderUID {
			continue
		}
		if item.GetAnnotations()[utils.AnnoKeyFolder] == accesscontrol.K6FolderUID {
			continue
		}
		visible = append(visible, item)
	}

	list.SetItems(visible)
	list.SetRemainingItemCount(nil)
	return list
}
