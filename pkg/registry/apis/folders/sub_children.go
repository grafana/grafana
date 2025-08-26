package folders

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
)

type subChildrenREST struct {
	lister rest.Lister
}

var _ = rest.Connecter(&subChildrenREST{})
var _ = rest.StorageMetadata(&subChildrenREST{})

// RootFolderName Hardcoded magic const to get root folders without parent.
var RootFolderName = "general"

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
	obj, err := r.lister.List(ctx, &internalversion.ListOptions{})
	if err != nil {
		return nil, err
	}
	allFolders, ok := obj.(*folders.FolderList)
	if !ok {
		return nil, fmt.Errorf("could not list folders")
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		children := &folders.FolderList{}
		parentName := ""

		if name != RootFolderName {
			parentName = name
		}
		for _, folder := range allFolders.Items {
			if parentName == getParent(&folder) {
				children.Items = append(children.Items, folder)
			}
		}

		responder.Object(http.StatusOK, children)
	}), nil
}
