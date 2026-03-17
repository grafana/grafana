package folders

import (
	"context"
	"fmt"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	foldersv1beta1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/services/folder"
)

type subParentsREST struct {
	getter  rest.Getter
	parents parentsGetter

	convertor runtime.ObjectConvertor
	newFunc   func() runtime.Object
}

var _ = rest.Connecter(&subParentsREST{})
var _ = rest.StorageMetadata(&subParentsREST{})

func (r *subParentsREST) New() runtime.Object {
	return r.newFunc()
}

func (r *subParentsREST) Destroy() {
}

func (r *subParentsREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *subParentsREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *subParentsREST) ProducesObject(verb string) interface{} {
	return r.newFunc()
}

func (r *subParentsREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *subParentsREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if name == folder.GeneralFolderUID || name == folder.SharedWithMeFolderUID {
			responder.Object(http.StatusOK, &foldersv1beta1.FolderInfoList{
				Items: []foldersv1beta1.FolderInfo{},
			})
			return
		}

		obj, err := r.getter.Get(ctx, name, &metav1.GetOptions{})
		if err != nil {
			responder.Error(err)
			return
		}

		var folderObj *foldersv1beta1.Folder
		switch v := obj.(type) {
		case *foldersv1beta1.Folder:
			folderObj = v
		case *foldersv1.Folder:
			folderObj = &foldersv1beta1.Folder{}
			if err := r.convertor.Convert(v, folderObj, nil); err != nil {
				responder.Error(fmt.Errorf("convert folder list: %w", err))
				return
			}
		}

		info, err := r.parents(ctx, folderObj)
		if err != nil {
			responder.Error(err)
			return
		}
		responder.Object(http.StatusOK, info)
	}), nil
}
