package folders

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/folder"
)

type subChildrenREST struct {
	lister rest.Lister
}

var _ = rest.Connecter(&subChildrenREST{})
var _ = rest.StorageMetadata(&subChildrenREST{})

func (r *subChildrenREST) New() runtime.Object {
	return &folders.FolderList{}
}

func (r *subChildrenREST) Destroy() {
}

func (r *subChildrenREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *subChildrenREST) ProducesObject(verb string) interface{} {
	return &folders.FolderList{}
}

func (r *subChildrenREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *subChildrenREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *subChildrenREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	obj, err := r.lister.List(ctx, &internalversion.ListOptions{
		Limit: 500,
		// TODO, field selector
	})
	if err != nil {
		return nil, err
	}
	allFolders, ok := obj.(*folders.FolderList)
	if !ok {
		return nil, fmt.Errorf("could not list folders")
	}
	if allFolders.Continue != "" {
		return nil, fmt.Errorf("found too many folders to process")
	}

	if name == folder.GeneralFolderUID {
		name = "" // general is empty
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		children := &folders.FolderList{}
		for _, folder := range allFolders.Items {
			v, err := utils.MetaAccessor(folder)
			if err != nil {
				continue
			}

			if name == v.GetFolder() {
				children.Items = append(children.Items, folder)
			}
		}

		responder.Object(http.StatusOK, children)
	}), nil
}
