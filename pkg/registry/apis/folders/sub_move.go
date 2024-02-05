package folders

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/folder"
)

type subMoveREST struct {
	service    folder.Service
	namespacer request.NamespaceMapper
}

var _ = rest.Connecter(&subMoveREST{})

func (r *subMoveREST) New() runtime.Object {
	return &v0alpha1.Folder{}
}

func (r *subMoveREST) Destroy() {
}

func (r *subMoveREST) ConnectMethods() []string {
	return []string{"POST"}
}

func (r *subMoveREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *subMoveREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		target := req.FormValue("parent")
		if target == "" {
			responder.Error(fmt.Errorf("missing parent parameter"))
			return
		}

		f, err := r.service.Move(ctx, &folder.MoveFolderCommand{
			UID:          name,
			OrgID:        ns.OrgID,
			NewParentUID: target,
			SignedInUser: user,
		})
		if err != nil {
			responder.Error(err)
		} else {
			responder.Object(http.StatusOK, convertToK8sResource(f, r.namespacer))
		}
	}), nil
}
