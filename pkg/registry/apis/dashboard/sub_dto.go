package dashboard

import (
	"context"
	"fmt"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type dtoBuilder = func(dashboard runtime.Object, access *dashboard.DashboardAccess) (runtime.Object, error)

// The DTO returns everything the UI needs in a single request
type DTOConnector struct {
	getter        rest.Getter
	legacy        legacy.DashboardAccess
	unified       resource.ResourceClient
	largeObjects  apistore.LargeObjectSupport
	accessControl accesscontrol.AccessControl
	scheme        *runtime.Scheme
	builder       dtoBuilder
}

func NewDTOConnector(
	getter rest.Getter,
	largeObjects apistore.LargeObjectSupport,
	legacyAccess legacy.DashboardAccess,
	resourceClient resource.ResourceClient,
	accessControl accesscontrol.AccessControl,
	scheme *runtime.Scheme,
	builder dtoBuilder,
) (rest.Storage, error) {
	return &DTOConnector{
		getter:        getter,
		legacy:        legacyAccess,
		accessControl: accessControl,
		unified:       resourceClient,
		largeObjects:  largeObjects,
		builder:       builder,
		scheme:        scheme,
	}, nil
}

var (
	_ rest.Connecter       = (*DTOConnector)(nil)
	_ rest.StorageMetadata = (*DTOConnector)(nil)
)

func (r *DTOConnector) New() runtime.Object {
	obj, _ := r.builder(nil, nil)
	return obj
}

func (r *DTOConnector) Destroy() {
}

func (r *DTOConnector) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *DTOConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (r *DTOConnector) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *DTOConnector) ProducesObject(verb string) interface{} {
	return r.New()
}

func (r *DTOConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	_, err := request.NamespaceInfoFrom(ctx, true)
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
	obj, err := utils.MetaAccessor(rawobj)
	if err != nil {
		return nil, err
	}

	// Check for blob info
	blobInfo := obj.GetBlob()
	if blobInfo != nil && r.largeObjects != nil {
		gr := r.largeObjects.GroupResource()
		err = r.largeObjects.Reconstruct(ctx, &resourcepb.ResourceKey{
			Group:     gr.Group,
			Resource:  gr.Resource,
			Namespace: obj.GetNamespace(),
			Name:      obj.GetName(),
		}, r.unified, obj)
		if err != nil {
			return nil, err
		}
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		// Skip the access info and return the dashboard that may be loaded with large object support
		if req.URL.Query().Get("includeAccess") == "false" {
			responder.Object(200, rawobj)
			return
		}

		dashScope := dashboards.ScopeDashboardsProvider.GetResourceScopeUID(name)
		evaluator := accesscontrol.EvalPermission(dashboards.ActionDashboardsRead, dashScope)
		canView, err := r.accessControl.Evaluate(ctx, user, evaluator)
		if err != nil || !canView {
			responder.Error(fmt.Errorf("not allowed to view"))
			return
		}

		access := &dashboard.DashboardAccess{}
		writeEvaluator := accesscontrol.EvalPermission(dashboards.ActionDashboardsWrite, dashScope)
		access.CanSave, _ = r.accessControl.Evaluate(ctx, user, writeEvaluator)
		access.CanEdit = access.CanSave
		adminEvaluator := accesscontrol.EvalPermission(dashboards.ActionDashboardsPermissionsWrite, dashScope)
		access.CanAdmin, _ = r.accessControl.Evaluate(ctx, user, adminEvaluator)
		deleteEvaluator := accesscontrol.EvalPermission(dashboards.ActionDashboardsDelete, dashScope)
		access.CanDelete, _ = r.accessControl.Evaluate(ctx, user, deleteEvaluator)
		access.CanStar = user.IsIdentityType(claims.TypeUser)

		access.AnnotationsPermissions = &dashboard.AnnotationPermission{}
		r.getAnnotationPermissionsByScope(ctx, user, &access.AnnotationsPermissions.Dashboard, accesscontrol.ScopeAnnotationsTypeDashboard)
		r.getAnnotationPermissionsByScope(ctx, user, &access.AnnotationsPermissions.Organization, accesscontrol.ScopeAnnotationsTypeOrganization)

		// FIXME!!!! does not get the title!
		// The title property next to unstructured and not found in this model
		title := obj.FindTitle("")
		access.Slug = slugify.Slugify(title)
		access.Url = dashboards.GetDashboardFolderURL(false, name, access.Slug)

		dash, err := r.builder(rawobj, access)
		if err != nil {
			responder.Error(err)
			return
		}
		responder.Object(http.StatusOK, dash)
	}), nil
}

func (r *DTOConnector) getAnnotationPermissionsByScope(ctx context.Context, user identity.Requester, actions *dashboard.AnnotationActions, scope string) {
	var err error
	logger := logging.FromContext(ctx).With("logger", "dto-connector")

	evaluate := accesscontrol.EvalPermission(accesscontrol.ActionAnnotationsCreate, scope)
	actions.CanAdd, err = r.accessControl.Evaluate(ctx, user, evaluate)
	if err != nil {
		logger.Warn("Failed to evaluate permission", "err", err, "action", accesscontrol.ActionAnnotationsCreate, "scope", scope)
	}

	evaluate = accesscontrol.EvalPermission(accesscontrol.ActionAnnotationsDelete, scope)
	actions.CanDelete, err = r.accessControl.Evaluate(ctx, user, evaluate)
	if err != nil {
		logger.Warn("Failed to evaluate permission", "err", err, "action", accesscontrol.ActionAnnotationsDelete, "scope", scope)
	}

	evaluate = accesscontrol.EvalPermission(accesscontrol.ActionAnnotationsWrite, scope)
	actions.CanEdit, err = r.accessControl.Evaluate(ctx, user, evaluate)
	if err != nil {
		logger.Warn("Failed to evaluate permission", "err", err, "action", accesscontrol.ActionAnnotationsWrite, "scope", scope)
	}
}
