package folders

import (
	"context"
	"fmt"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
	"net/http"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
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
	return &metav1.ListOptions{}, false, "" // true means you can use the trailing path as a variable
}

func (r *subChildrenREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	options, ok := opts.(*metav1.ListOptions)
	if !ok {
		return nil, fmt.Errorf("opts is not a metav1.GetOptions")
	}

	obj, err := r.lister.List(ctx, &internalversion.ListOptions{
		TypeMeta:             options.TypeMeta,
		LabelSelector:        nil,
		FieldSelector:        nil,
		Watch:                options.Watch,
		AllowWatchBookmarks:  options.AllowWatchBookmarks,
		ResourceVersion:      options.ResourceVersion,
		ResourceVersionMatch: options.ResourceVersionMatch,
		TimeoutSeconds:       options.TimeoutSeconds,
		Limit:                0,
		Continue:             options.Continue,
		SendInitialEvents:    options.SendInitialEvents,
	})
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
		if name != "general" {
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
