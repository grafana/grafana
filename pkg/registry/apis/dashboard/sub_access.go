package dashboard

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	dashboard "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	dashboardssvc "github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/guardian"
)

type AccessREST struct {
	builder *DashboardsAPIBuilder
}

var _ = rest.Connecter(&AccessREST{})
var _ = rest.StorageMetadata(&AccessREST{})

func (r *AccessREST) New() runtime.Object {
	return &dashboard.DashboardAccessInfo{}
}

func (r *AccessREST) Destroy() {
}

func (r *AccessREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *AccessREST) NewConnectOptions() (runtime.Object, bool, string) {
	return &dashboard.VersionsQueryOptions{}, false, ""
}

func (r *AccessREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *AccessREST) ProducesObject(verb string) interface{} {
	return &dashboard.DashboardAccessInfo{}
}

func (r *AccessREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}

	dto, err := r.builder.dashboardService.GetDashboard(ctx, &dashboardssvc.GetDashboardQuery{
		UID:   name,
		OrgID: info.OrgID,
	})
	if err != nil {
		return nil, err
	}

	guardian, err := guardian.NewByDashboard(ctx, dto, info.OrgID, user)
	if err != nil {
		return nil, err
	}
	canView, err := guardian.CanView()
	if err != nil || !canView {
		return nil, fmt.Errorf("not allowed to view")
	}

	access := &dashboard.DashboardAccessInfo{}
	access.CanEdit, _ = guardian.CanEdit()
	access.CanSave, _ = guardian.CanSave()
	access.CanAdmin, _ = guardian.CanAdmin()
	access.CanDelete, _ = guardian.CanDelete()
	access.CanStar = user.IsRealUser() && !user.IsAnonymous

	access.AnnotationsPermissions = &dashboard.AnnotationPermission{}
	r.getAnnotationPermissionsByScope(ctx, user, &access.AnnotationsPermissions.Dashboard, accesscontrol.ScopeAnnotationsTypeDashboard)
	r.getAnnotationPermissionsByScope(ctx, user, &access.AnnotationsPermissions.Organization, accesscontrol.ScopeAnnotationsTypeOrganization)

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		responder.Object(http.StatusOK, access)
	}), nil
}

func (r *AccessREST) getAnnotationPermissionsByScope(ctx context.Context, user identity.Requester, actions *dashboard.AnnotationActions, scope string) {
	var err error

	evaluate := accesscontrol.EvalPermission(accesscontrol.ActionAnnotationsCreate, scope)
	actions.CanAdd, err = r.builder.accessControl.Evaluate(ctx, user, evaluate)
	if err != nil {
		r.builder.log.Warn("Failed to evaluate permission", "err", err, "action", accesscontrol.ActionAnnotationsCreate, "scope", scope)
	}

	evaluate = accesscontrol.EvalPermission(accesscontrol.ActionAnnotationsDelete, scope)
	actions.CanDelete, err = r.builder.accessControl.Evaluate(ctx, user, evaluate)
	if err != nil {
		r.builder.log.Warn("Failed to evaluate permission", "err", err, "action", accesscontrol.ActionAnnotationsDelete, "scope", scope)
	}

	evaluate = accesscontrol.EvalPermission(accesscontrol.ActionAnnotationsWrite, scope)
	actions.CanEdit, err = r.builder.accessControl.Evaluate(ctx, user, evaluate)
	if err != nil {
		r.builder.log.Warn("Failed to evaluate permission", "err", err, "action", accesscontrol.ActionAnnotationsWrite, "scope", scope)
	}
}
