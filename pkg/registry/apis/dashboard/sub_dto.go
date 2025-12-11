package dashboard

import (
	"context"
	"fmt"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util"
)

type dtoBuilder = func(dashboard runtime.Object, access *dashboard.DashboardAccess) (runtime.Object, error)

// The DTO returns everything the UI needs in a single request
type DTOConnector struct {
	getter                 rest.Getter
	unified                resource.ResourceClient
	largeObjects           apistore.LargeObjectSupport
	accessClient           authlib.AccessClient
	builder                dtoBuilder
	publicDashboardService publicdashboards.Service
}

func NewDTOConnector(
	getter rest.Getter,
	largeObjects apistore.LargeObjectSupport,
	resourceClient resource.ResourceClient,
	accessClient authlib.AccessClient,
	builder dtoBuilder,
	publicDashboardService publicdashboards.Service,
) (rest.Storage, error) {
	return &DTOConnector{
		getter:                 getter,
		accessClient:           accessClient,
		unified:                resourceClient,
		largeObjects:           largeObjects,
		builder:                builder,
		publicDashboardService: publicDashboardService,
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

		logger := logging.FromContext(ctx).With("logger", "dto-connector")
		access := &dashboard.DashboardAccess{}
		folder := obj.GetFolder()
		ns := obj.GetNamespace()

		authInfo, ok := authlib.AuthInfoFrom(ctx)
		if !ok {
			responder.Error(fmt.Errorf("no identity found for request"))
			return
		}

		gvr := dashv1.DashboardResourceInfo.GroupVersionResource()

		// Check read permission using authlib.AccessClient
		readRes, err := r.accessClient.Check(ctx, authInfo, authlib.CheckRequest{
			Verb:      utils.VerbGet,
			Group:     gvr.Group,
			Resource:  gvr.Resource,
			Namespace: ns,
			Name:      name,
		}, folder)
		if err != nil {
			logger.Warn("Failed to check read permission", "err", err)
			responder.Error(fmt.Errorf("not allowed to view"))
			return
		}
		if !readRes.Allowed {
			responder.Error(fmt.Errorf("not allowed to view"))
			return
		}

		// Check write permission
		writeRes, err := r.accessClient.Check(ctx, authInfo, authlib.CheckRequest{
			Verb:      utils.VerbUpdate,
			Group:     gvr.Group,
			Resource:  gvr.Resource,
			Namespace: ns,
			Name:      name,
		}, folder)
		// Keeping the same logic as with accessControl.Evaluate.
		// On errors we default on deny.
		if err != nil {
			logger.Warn("Failed to check write permission", "err", err)
		}
		access.CanSave = writeRes.Allowed
		access.CanEdit = writeRes.Allowed

		// Check delete permission
		deleteRes, err := r.accessClient.Check(ctx, authInfo, authlib.CheckRequest{
			Verb:      utils.VerbDelete,
			Group:     gvr.Group,
			Resource:  gvr.Resource,
			Namespace: ns,
			Name:      name,
		}, folder)
		if err != nil {
			logger.Warn("Failed to check delete permission", "err", err)
		}
		access.CanDelete = deleteRes.Allowed

		// For admin permission, use write as a proxy for now
		access.CanAdmin = writeRes.Allowed

		access.CanStar = user.IsIdentityType(authlib.TypeUser)

		// Annotation permissions - use write permission as proxy
		access.AnnotationsPermissions = &dashboard.AnnotationPermission{
			Dashboard:    dashboard.AnnotationActions{CanAdd: writeRes.Allowed, CanEdit: writeRes.Allowed, CanDelete: writeRes.Allowed},
			Organization: dashboard.AnnotationActions{CanAdd: writeRes.Allowed, CanEdit: writeRes.Allowed, CanDelete: writeRes.Allowed},
		}

		title := obj.FindTitle("")
		access.Slug = slugify.Slugify(title)
		access.Url = dashboards.GetDashboardFolderURL(false, name, access.Slug)

		// Only check public dashboards if service is available
		if !util.IsInterfaceNil(r.publicDashboardService) {
			pubDash, err := r.publicDashboardService.FindByDashboardUid(ctx, user.GetOrgID(), name)
			if err == nil && pubDash != nil {
				access.IsPublic = true
			}
		}

		dash, err := r.builder(rawobj, access)
		if err != nil {
			responder.Error(err)
			return
		}
		responder.Object(http.StatusOK, dash)
	}), nil
}
