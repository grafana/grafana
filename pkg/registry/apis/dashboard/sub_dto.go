package dashboard

import (
	"context"
	"fmt"
	"maps"
	"net/http"
	"sync"

	"golang.org/x/sync/errgroup"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/home"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/util"
)

type dtoBuilder = func(dashboard runtime.Object, access *dashboard.DashboardAccess) (runtime.Object, error)

// The DTO returns everything the UI needs in a single request
type DTOConnector struct {
	getter                 rest.Getter
	accessClient           authlib.AccessClient
	builder                dtoBuilder
	publicDashboardService publicdashboards.Service
}

func NewDTOConnector(
	getter rest.Getter,
	resourceClient resource.ResourceClient,
	accessClient authlib.AccessClient,
	builder dtoBuilder,
	publicDashboardService publicdashboards.Service,
) (rest.Storage, error) {
	return &DTOConnector{
		getter:                 getter,
		accessClient:           accessClient,
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

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		// Skip the access info and return the dashboard that may be loaded with large object support
		if req.URL.Query().Get("includeAccess") == "false" {
			responder.Object(200, rawobj)
			return
		}

		if name == home.DASHBOARD_NAME {
			dash, err := r.builder(rawobj, &dashboard.DashboardAccess{
				Slug: "home",
				Url:  dashboards.GetDashboardFolderURL(false, name, "home"),
			})
			if err != nil {
				responder.Error(err)
			} else {
				responder.Object(http.StatusOK, dash)
			}
			return
		}

		authInfo, ok := authlib.AuthInfoFrom(ctx)
		if !ok {
			responder.Error(fmt.Errorf("no identity found for request"))
			return
		}

		logger := logging.FromContext(ctx).With("logger", "dto-connector")
		access := &dashboard.DashboardAccess{}
		folder := obj.GetFolder()
		gvr := dashv1.DashboardResourceInfo.GroupVersionResource()

		// The dashboard and annotation checks travel in separate batches because
		// the authz rollout routes a batch by its group/resource/subresource: a
		// batch mixing the two would be sent to RBAC wholesale, taking this
		// endpoint out of any dashboards rollout.
		dashChecks := []authlib.BatchCheckItem{
			{
				CorrelationID: "dash_read",
				Verb:          utils.VerbGet,
				Group:         gvr.Group,
				Resource:      gvr.Resource,
				Name:          name,
				Folder:        folder,
			},
			{
				CorrelationID: "dash_write",
				Verb:          utils.VerbUpdate,
				Group:         gvr.Group,
				Resource:      gvr.Resource,
				Name:          name,
				Folder:        folder,
			},
			{
				CorrelationID: "dash_delete",
				Verb:          utils.VerbDelete,
				Group:         gvr.Group,
				Resource:      gvr.Resource,
				Name:          name,
				Folder:        folder,
			},
			{
				CorrelationID: "dash_admin",
				Verb:          utils.VerbSetPermissions,
				Group:         gvr.Group,
				Resource:      gvr.Resource,
				Name:          name,
				Folder:        folder,
			},
		}
		annotationChecks := []authlib.BatchCheckItem{
			{
				CorrelationID: "annot_create",
				Verb:          utils.VerbCreate,
				Group:         gvr.Group,
				Resource:      gvr.Resource,
				Subresource:   "annotations",
				Name:          name,
				Folder:        folder,
			},
			{
				CorrelationID: "annot_update",
				Verb:          utils.VerbUpdate,
				Group:         gvr.Group,
				Resource:      gvr.Resource,
				Subresource:   "annotations",
				Name:          name,
				Folder:        folder,
			},
			{
				CorrelationID: "annot_delete",
				Verb:          utils.VerbDelete,
				Group:         gvr.Group,
				Resource:      gvr.Resource,
				Subresource:   "annotations",
				Name:          name,
				Folder:        folder,
			},
		}

		results := make(map[string]authlib.BatchCheckResult, len(dashChecks)+len(annotationChecks))
		var mu sync.Mutex
		g, gctx := errgroup.WithContext(ctx)
		for _, checks := range [][]authlib.BatchCheckItem{dashChecks, annotationChecks} {
			g.Go(func() error {
				res, err := r.accessClient.BatchCheck(gctx, authInfo, authlib.BatchCheckRequest{
					Namespace: obj.GetNamespace(),
					Checks:    checks,
				})
				if err != nil {
					return err
				}
				mu.Lock()
				defer mu.Unlock()
				maps.Copy(results, res.Results)
				return nil
			})
		}
		if err := g.Wait(); err != nil {
			logger.Warn("Failed to batch check permissions", "err", err)
			responder.Error(fmt.Errorf("failed to check permissions"))
			return
		}

		if !results["dash_read"].Allowed {
			responder.Error(fmt.Errorf("not allowed to view"))
			return
		}

		access.CanStar = user.IsIdentityType(authlib.TypeUser)
		access.CanSave = results["dash_write"].Allowed
		access.CanEdit = results["dash_write"].Allowed
		access.CanDelete = results["dash_delete"].Allowed
		access.CanAdmin = results["dash_admin"].Allowed
		access.AnnotationsPermissions = &dashboard.AnnotationPermission{Dashboard: dashboard.AnnotationActions{
			CanAdd:    results["annot_create"].Allowed,
			CanEdit:   results["annot_update"].Allowed,
			CanDelete: results["annot_delete"].Allowed,
		}}

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
