package folders

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	foldersv1beta1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/folder"
)

type subChildrenREST struct {
	getter rest.Getter
	lister rest.Lister

	convertor runtime.ObjectConvertor
	newFunc   func() runtime.Object
}

var _ = rest.Connecter(&subChildrenREST{})
var _ = rest.StorageMetadata(&subChildrenREST{})

func (r *subChildrenREST) New() runtime.Object {
	return r.newFunc()
}

func (r *subChildrenREST) Destroy() {
}

func (r *subChildrenREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *subChildrenREST) ProducesObject(verb string) interface{} {
	return r.newFunc()
}

func (r *subChildrenREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *subChildrenREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *subChildrenREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	if _, err := r.getter.Get(ctx, name, &v1.GetOptions{}); err != nil {
		return nil, err
	}

	obj, err := r.lister.List(ctx, &internalversion.ListOptions{
		Limit: 500,
		// TODO, field selector
	})
	if err != nil {
		return nil, err
	}

	var allFolders *foldersv1beta1.FolderList
	switch v := obj.(type) {
	case *foldersv1beta1.FolderList:
		allFolders = v
	case *foldersv1.FolderList:
		allFolders = &foldersv1beta1.FolderList{}
		if err := r.convertor.Convert(v, allFolders, nil); err != nil {
			return nil, fmt.Errorf("convert folder list: %w", err)
		}
	}

	if allFolders.Continue != "" {
		return nil, fmt.Errorf("found too many folders to process")
	}

	if name == folder.GeneralFolderUID {
		name = "" // general is empty
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		children := &foldersv1beta1.FolderList{}
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
