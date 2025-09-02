package folders

import (
	"context"
	"fmt"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/storage"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/services/folder"
)

type subParentsREST struct {
	getter  rest.Getter
	parents parentsGetter
}

var _ = rest.Connecter(&subParentsREST{})
var _ = rest.StorageMetadata(&subParentsREST{})

func (r *subParentsREST) New() runtime.Object {
	return &folders.FolderInfoList{}
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
	return &folders.FolderInfoList{}
}

func (r *subParentsREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *subParentsREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if name == folder.GeneralFolderUID || name == folder.SharedWithMeFolderUID {
			responder.Object(http.StatusOK, &folders.FolderInfoList{
				Items: []folders.FolderInfo{},
			})
			return
		}

		obj, err := r.getter.Get(ctx, name, &metav1.GetOptions{})
		if storage.IsNotFound(err) {
			responder.Object(http.StatusNotFound, nil)
			return
		}
		if err != nil {
			responder.Error(err)
			return
		}

		folderObj, ok := obj.(*folders.Folder)
		if !ok {
			responder.Error(fmt.Errorf("expecting folder, found: %T", folderObj))
			return
		}

		info, err := r.parents(ctx, folderObj)
		if err != nil {
			responder.Error(err)
			return
		}
		responder.Object(http.StatusOK, info)
	}), nil
}
