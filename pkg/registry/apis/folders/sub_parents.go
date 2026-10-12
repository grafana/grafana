package folders

import (
	"context"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/folder"
)

type subParentsREST struct {
	getter  rest.Getter
	parents parentsGetter
}

var _ rest.Connecter = (*subParentsREST)(nil)
var _ rest.StorageMetadata = (*subParentsREST)(nil)

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
		ctx, span := tracing.Start(ctx, "folder.parents")
		defer span.End()

		if name == folder.GeneralFolderUID || name == folder.SharedWithMeFolderUID {
			responder.Object(http.StatusOK, &folders.FolderInfoList{
				Items: []folders.FolderInfo{},
			})
			return
		}

		getCtx, getSpan := tracing.Start(ctx, "folder.parents.get")
		obj, err := r.getter.Get(getCtx, name, &metav1.GetOptions{})
		if err != nil {
			tracing.Error(getSpan, err)
		}
		getSpan.End()
		if err != nil {
			responder.Error(tracing.Error(span, err))
			return
		}

		folderObj, ok := obj.(*folders.Folder)
		if !ok {
			responder.Error(tracing.Errorf(span, "expecting folder, found: %T", folderObj))
			return
		}

		parentsCtx, parentsSpan := tracing.Start(ctx, "folder.parents.lookupParents")
		info, err := r.parents(parentsCtx, folderObj)
		if err != nil {
			tracing.Error(parentsSpan, err)
		}
		parentsSpan.End()
		if err != nil {
			responder.Error(tracing.Error(span, err))
			return
		}
		responder.Object(http.StatusOK, info)
	}), nil
}
