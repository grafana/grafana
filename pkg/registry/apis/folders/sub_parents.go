package folders

import (
	"context"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/folder"
)

type subParentsREST struct {
	service folder.Service
}

var _ = rest.Connecter(&subParentsREST{})
var _ = rest.StorageMetadata(&subParentsREST{})

func (r *subParentsREST) New() runtime.Object {
	return &v0alpha1.FolderInfoList{}
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
	return &v0alpha1.FolderInfoList{}
}

func (r *subParentsREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *subParentsREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		ns, err := request.NamespaceInfoFrom(ctx, true)
		if err != nil {
			responder.Error(err)
			return
		}

		parents, err := r.service.GetParents(ctx, folder.GetParentsQuery{
			UID:   name,
			OrgID: ns.OrgID,
		})
		if err != nil {
			responder.Error(err)
			return
		}

		info := &v0alpha1.FolderInfoList{
			Items: make([]v0alpha1.FolderInfo, 0),
		}
		for _, parent := range parents {
			info.Items = append(info.Items, v0alpha1.FolderInfo{
				UID:    parent.UID,
				Title:  parent.Title,
				Parent: parent.ParentUID,
			})
		}
		responder.Object(http.StatusOK, info)
	}), nil
}
