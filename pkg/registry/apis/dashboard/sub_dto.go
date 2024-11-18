package dashboard

import (
	"context"
	"fmt"
	"net/http"
	"strconv"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	dashboard "github.com/grafana/grafana/pkg/apis/dashboard"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// The DTO returns everything the UI needs in a single request
type DTOConnector struct {
	getter        rest.Getter
	legacy        legacy.DashboardAccess
	unified       resource.ResourceClient
	largeObjects  apistore.LargeObjectSupport
	accessControl accesscontrol.AccessControl
	scheme        *runtime.Scheme
	newFunc       func() runtime.Object
	log           log.Logger
}

func NewDTOConnector(
	dash rest.Storage,
	largeObjects apistore.LargeObjectSupport,
	legacyAccess legacy.DashboardAccess,
	resourceClient resource.ResourceClient,
	accessControl accesscontrol.AccessControl,
	scheme *runtime.Scheme,
	newFunc func() runtime.Object,
) (rest.Storage, error) {
	ok := false
	v := &DTOConnector{
		legacy:        legacyAccess,
		accessControl: accessControl,
		unified:       resourceClient,
		largeObjects:  largeObjects,
		newFunc:       newFunc,
		scheme:        scheme,
		log:           log.New("grafana-apiserver.dashboards.dto-connector"),
	}
	v.getter, ok = dash.(rest.Getter)
	if !ok {
		return nil, fmt.Errorf("dashboard storage must implement getter")
	}
	return v, nil
}

var (
	_ rest.Connecter       = (*DTOConnector)(nil)
	_ rest.StorageMetadata = (*DTOConnector)(nil)
)

func (r *DTOConnector) New() runtime.Object {
	return r.newFunc()
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
	return r.newFunc()
}

func (r *DTOConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	rawobj, err := r.getter.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	dash, err := ToInternalDashboard(r.scheme, rawobj)
	if err != nil {
		return nil, err
	}

	obj, err := utils.MetaAccessor(dash)
	if err != nil {
		return nil, err
	}

	dto := &dashboards.Dashboard{
		UID:   name,
		OrgID: info.OrgID,
	}
	repo, err := obj.GetRepositoryInfo()
	if err != nil {
		return nil, err
	}
	if repo != nil && repo.Name == "SQL" {
		dto.ID, err = strconv.ParseInt(repo.Path, 10, 64)
		if err == nil {
			return nil, err
		}
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
	access.CanStar = user.IsIdentityType(claims.TypeUser)

	access.AnnotationsPermissions = &dashboard.AnnotationPermission{}
	r.getAnnotationPermissionsByScope(ctx, user, &access.AnnotationsPermissions.Dashboard, accesscontrol.ScopeAnnotationsTypeDashboard)
	r.getAnnotationPermissionsByScope(ctx, user, &access.AnnotationsPermissions.Organization, accesscontrol.ScopeAnnotationsTypeOrganization)

	// Check for blob info
	blobInfo := obj.GetBlob()
	if blobInfo != nil && r.largeObjects != nil {
		gr := r.largeObjects.GroupResource()
		err = r.largeObjects.Reconstruct(ctx, &resource.ResourceKey{
			Group:     gr.Group,
			Resource:  gr.Resource,
			Namespace: obj.GetNamespace(),
			Name:      obj.GetName(),
		}, r.unified, obj)
		if err != nil {
			return nil, err
		}
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
	actions.CanAdd, err = r.accessControl.Evaluate(ctx, user, evaluate)
	if err != nil {
		r.log.Warn("Failed to evaluate permission", "err", err, "action", accesscontrol.ActionAnnotationsCreate, "scope", scope)
	}

	evaluate = accesscontrol.EvalPermission(accesscontrol.ActionAnnotationsDelete, scope)
	actions.CanDelete, err = r.accessControl.Evaluate(ctx, user, evaluate)
	if err != nil {
		r.log.Warn("Failed to evaluate permission", "err", err, "action", accesscontrol.ActionAnnotationsDelete, "scope", scope)
	}

	evaluate = accesscontrol.EvalPermission(accesscontrol.ActionAnnotationsWrite, scope)
	actions.CanEdit, err = r.accessControl.Evaluate(ctx, user, evaluate)
	if err != nil {
		r.log.Warn("Failed to evaluate permission", "err", err, "action", accesscontrol.ActionAnnotationsWrite, "scope", scope)
	}
}
