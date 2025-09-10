package folders

import (
	"context"
	"net/http"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

type subAccessREST struct {
	getter rest.Getter
	ac     accesscontrol.AccessControl
}

var _ = rest.Connecter(&subAccessREST{})
var _ = rest.StorageMetadata(&subAccessREST{})

func (r *subAccessREST) New() runtime.Object {
	return &folders.FolderAccessInfo{}
}

func (r *subAccessREST) Destroy() {
}

func (r *subAccessREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *subAccessREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *subAccessREST) ProducesObject(verb string) interface{} {
	return &folders.FolderAccessInfo{}
}

func (r *subAccessREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *subAccessREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	// Must be able to get the resource
	_, err = r.getter.Get(ctx, name, &v1.GetOptions{})
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		access := &folders.FolderAccessInfo{}
		canEditEvaluator := accesscontrol.EvalPermission(dashboards.ActionFoldersWrite, dashboards.ScopeFoldersProvider.GetResourceScopeUID(name))
		access.CanEdit, _ = r.ac.Evaluate(ctx, user, canEditEvaluator)
		access.CanSave = access.CanEdit
		canAdminEvaluator := accesscontrol.EvalAll(
			accesscontrol.EvalPermission(dashboards.ActionFoldersPermissionsRead, dashboards.ScopeFoldersProvider.GetResourceScopeUID(name)),
			accesscontrol.EvalPermission(dashboards.ActionFoldersPermissionsWrite, dashboards.ScopeFoldersProvider.GetResourceScopeUID(name)),
		)
		access.CanAdmin, _ = r.ac.Evaluate(ctx, user, canAdminEvaluator)
		canDeleteEvaluator := accesscontrol.EvalPermission(dashboards.ActionFoldersDelete, dashboards.ScopeFoldersProvider.GetResourceScopeUID(name))
		access.CanDelete, _ = r.ac.Evaluate(ctx, user, canDeleteEvaluator)
		responder.Object(http.StatusOK, access)
	}), nil
}
