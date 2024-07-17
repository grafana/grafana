package dashboard

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	dashboard "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// The DTO returns everything the UI needs in a single request
type DTOConnector struct {
	builder *DashboardsAPIBuilder
}

var (
	_ rest.Connecter       = (*DTOConnector)(nil)
	_ rest.StorageMetadata = (*DTOConnector)(nil)
)

func (r *DTOConnector) New() runtime.Object {
	return &dashboard.DashboardWithAccessInfo{}
}

func (r *DTOConnector) Destroy() {
}

func (r *DTOConnector) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *DTOConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return &dashboard.VersionsQueryOptions{}, false, ""
}

func (r *DTOConnector) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *DTOConnector) ProducesObject(verb string) interface{} {
	return &dashboard.DashboardWithAccessInfo{}
}

func (r *DTOConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}

	dto, err := r.builder.dashboardService.GetDashboard(ctx, &dashboards.GetDashboardQuery{
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

	access := dashboard.DashboardAccess{}
	access.CanEdit, _ = guardian.CanEdit()
	access.CanSave, _ = guardian.CanSave()
	access.CanAdmin, _ = guardian.CanAdmin()
	access.CanDelete, _ = guardian.CanDelete()
	access.CanStar = user.IsRealUser() && !user.IsAnonymous

	access.AnnotationsPermissions = &dashboard.AnnotationPermission{}
	r.getAnnotationPermissionsByScope(ctx, user, &access.AnnotationsPermissions.Dashboard, accesscontrol.ScopeAnnotationsTypeDashboard)
	r.getAnnotationPermissionsByScope(ctx, user, &access.AnnotationsPermissions.Organization, accesscontrol.ScopeAnnotationsTypeOrganization)

	key := &resource.ResourceKey{
		Namespace: info.Value,
		Group:     dashboard.GROUP,
		Resource:  dashboard.DashboardResourceInfo.GroupResource().Resource,
		Name:      name,
	}
	store := r.builder.legacy.access
	rsp, err := store.Read(ctx, &resource.ReadRequest{Key: key})
	if err != nil {
		return nil, err
	}
	dash := &dashboard.Dashboard{}
	err = json.Unmarshal(rsp.Value, dash)
	if err != nil {
		return nil, err
	}

	obj, err := utils.MetaAccessor(dash)
	if err != nil {
		return nil, err
	}
	blobInfo := obj.GetBlob()
	if blobInfo != nil {
		fmt.Printf("TODO, load full blob from storage %+v\n", blobInfo)
	}

	access.Slug = slugify.Slugify(dash.Spec.GetNestedString("title"))
	access.Url = dashboards.GetDashboardFolderURL(false, name, access.Slug)

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		responder.Object(http.StatusOK, &dashboard.DashboardWithAccessInfo{
			Dashboard: *dash,
			Access:    access,
		})
	}), nil
}

func (r *DTOConnector) getAnnotationPermissionsByScope(ctx context.Context, user identity.Requester, actions *dashboard.AnnotationActions, scope string) {
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
