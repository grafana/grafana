package snapshots

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/api/response"
	snapshots "github.com/grafana/grafana/pkg/apis/snapshots/v0alpha1"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

var (
	_ rest.Scoper               = (*legacyStorage)(nil)
	_ rest.SingularNameProvider = (*legacyStorage)(nil)
	_ rest.Getter               = (*legacyStorage)(nil)
	_ rest.Lister               = (*legacyStorage)(nil)
	_ rest.Storage              = (*legacyStorage)(nil)
	_ rest.GracefulDeleter      = (*legacyStorage)(nil)
)

type legacyStorage struct {
	service        dashboardsnapshots.Service
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor

	DefaultQualifiedResource  schema.GroupResource
	SingularQualifiedResource schema.GroupResource
}

func (s *legacyStorage) New() runtime.Object {
	return &snapshots.DashboardSnapshot{}
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStorage) GetSingularName() string {
	return "dashboard"
}

func (s *legacyStorage) NewList() runtime.Object {
	return &snapshots.DashboardSnapshotList{}
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	// TODO: handle fetching all available orgs when no namespace is specified
	// To test: kubectl get playlists --all-namespaces
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}

	limit := 100
	if options.Limit > 0 {
		limit = int(options.Limit)
	}
	res, err := s.service.SearchDashboardSnapshots(ctx, &dashboardsnapshots.GetDashboardSnapshotsQuery{
		OrgID:        info.OrgID,
		SignedInUser: user,
	})
	if err != nil {
		return nil, err
	}

	list := &snapshots.DashboardSnapshotList{}
	for _, v := range res {
		list.Items = append(list.Items, *convertDTOToSnapshot(v, s.namespacer))
	}
	if len(list.Items) == limit {
		list.Continue = "<more>" // TODO?
	}
	return list, nil
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	v, err := s.service.GetDashboardSnapshot(ctx, &dashboardsnapshots.GetDashboardSnapshotQuery{
		Key: name,
	})
	if err != nil || v == nil {
		// if errors.Is(err, playlistsvc.ErrPlaylistNotFound) || err == nil {
		// 	err = k8serrors.NewNotFound(s.SingularQualifiedResource, name)
		// }
		return nil, err
	}

	return convertSnapshotToK8sResource(v, s.namespacer), nil
}

// if !hs.Cfg.SnapshotEnabled {
// 	c.JsonApiErr(http.StatusForbidden, "Dashboard Snapshots are disabled", nil)
// 	return nil
// }

func (s *legacyStorage) DoCreate(w http.ResponseWriter, req *http.Request) {
	ctx := req.Context()
	user, err := appcontext.User(ctx)
	wrap := &contextmodel.ReqContext{
		SignedInUser: user,
	}
	wrap.Req = req
	wrap.Resp = web.NewResponseWriter(req.Method, w)

	cmd := dashboardsnapshots.CreateDashboardSnapshotCommand{}
	if err := web.Bind(req, &cmd); err != nil {
		rsp := response.Error(http.StatusBadRequest, "bad request data", err)
		rsp.WriteTo(wrap)
		return
	}

	if cmd.Name == "" {
		cmd.Name = "Unnamed snapshot"
	}

	userID, err := identity.UserIdentifier(user.GetNamespacedID())
	if err != nil {
		rsp := response.Error(http.StatusInternalServerError,
			"Failed to create external snapshot", err)
		rsp.WriteTo(wrap)
		return
	}

	var snapshotUrl string
	cmd.ExternalURL = ""
	cmd.OrgID = user.GetOrgID()
	cmd.UserID = userID
	originalDashboardURL, err := createOriginalDashboardURL(&cmd)
	if err != nil {
		response.Error(http.StatusInternalServerError, "Invalid app URL", err).WriteTo(wrap)
		return
	}

	if cmd.External {
		// if !hs.Cfg.ExternalEnabled {
		// 	c.JsonApiErr(http.StatusForbidden, "External dashboard creation is disabled", nil)
		// 	return nil
		// }

		resp, err := createExternalDashboardSnapshot(cmd, hs.Cfg.ExternalSnapshotUrl)
		if err != nil {
			wrap.JsonApiErr(http.StatusInternalServerError, "Failed to create external snapshot", err)
			return
		}

		snapshotUrl = resp.Url
		cmd.Key = resp.Key
		cmd.DeleteKey = resp.DeleteKey
		cmd.ExternalURL = resp.Url
		cmd.ExternalDeleteURL = resp.DeleteUrl
		cmd.Dashboard = simplejson.New()

		metrics.MApiDashboardSnapshotExternal.Inc()
	} else {
		cmd.Dashboard.SetPath([]string{"snapshot", "originalUrl"}, originalDashboardURL)

		if cmd.Key == "" {
			var err error
			cmd.Key, err = util.GetRandomString(32)
			if err != nil {
				wrap.JsonApiErr(http.StatusInternalServerError, "Could not generate random string", err)
				return
			}
		}

		if cmd.DeleteKey == "" {
			var err error
			cmd.DeleteKey, err = util.GetRandomString(32)
			if err != nil {
				wrap.JsonApiErr(http.StatusInternalServerError, "Could not generate random string", err)
				return
			}
		}

		snapshotUrl = setting.ToAbsUrl("dashboard/snapshot/" + cmd.Key)

		metrics.MApiDashboardSnapshotCreate.Inc()
	}

	result, err := s.service.CreateDashboardSnapshot(ctx, &cmd)
	if err != nil {
		wrap.JsonApiErr(http.StatusInternalServerError, "Failed to create snapshot", err)
		return
	}

	// TODO?? change the response
	wrap.JSON(http.StatusOK, util.DynMap{
		"key":       cmd.Key,
		"deleteKey": cmd.DeleteKey,
		"url":       snapshotUrl,
		"deleteUrl": setting.ToAbsUrl("api/snapshots-delete/" + cmd.DeleteKey),
		"id":        result.ID,
	})
}

// func (s *legacyStorage) DoCreate(ctx context.Context,
// 	obj runtime.Object,
// 	createValidation rest.ValidateObjectFunc,
// 	options *metav1.CreateOptions,
// ) (runtime.Object, error) {
// 	user, err := appcontext.User(ctx)
// 	if err != nil {
// 		return nil, err
// 	}
// 	info, err := request.NamespaceInfoFrom(ctx, true)
// 	if err != nil {
// 		return nil, err
// 	}
// 	if info.OrgID < 1 {
// 		return nil, fmt.Errorf("invalid namespace")
// 	}

// 	snap, ok := obj.(*snapshots.DashboardSnapshot)
// 	if !ok {
// 		return nil, fmt.Errorf("expected playlist?")
// 	}
// 	if snap.Name == "" {
// 		snap.Name = util.GenerateShortUID()
// 	}
// 	if snap.DeleteKey == "" {
// 		snap.DeleteKey = util.GenerateShortUID()
// 	}

// 	userID, err := identity.UserIdentifier(user.GetNamespacedID())
// 	if err != nil {
// 		return nil, fmt.Errorf("unable to get user id")
// 	}

// 	// Create the dashboard on the external server
// 	if snap.Info.External {
// 		return nil, fmt.Errorf("not implemented yet")
// 	}

// 	out, err := s.service.CreateDashboardSnapshot(ctx, &dashboardsnapshots.CreateDashboardSnapshotCommand{
// 		Name:      snap.Info.Title,
// 		OrgID:     info.OrgID,
// 		UserID:    userID,
// 		Key:       snap.Name,
// 		DeleteKey: snap.DeleteKey,
// 		Expires:   snap.Info.Expires,

// 		// encrypted?
// 		Dashboard: snap.Dashboard,
// 	})
// 	if err != nil {
// 		return nil, err
// 	}

// 	// TODO, copy more?
// 	snap.DeleteKey = out.DeleteKey
// 	return snap, err
// }

// GracefulDeleter
func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	snap, err := s.service.GetDashboardSnapshot(ctx, &dashboardsnapshots.GetDashboardSnapshotQuery{
		Key: name,
	})
	if err != nil || snap == nil {
		return nil, false, err
	}

	if snap.External {
		return nil, false, fmt.Errorf("TODO... support external delete commands")
	}

	err = s.service.DeleteDashboardSnapshot(ctx, &dashboardsnapshots.DeleteDashboardSnapshotCommand{
		DeleteKey: snap.DeleteKey,
	})
	if err != nil {
		return nil, false, err
	}
	return nil, true, nil
}

func createOriginalDashboardURL(cmd *dashboardsnapshots.CreateDashboardSnapshotCommand) (string, error) {
	dashUID := cmd.Dashboard.Get("uid").MustString("")
	if ok := util.IsValidShortUID(dashUID); !ok {
		return "", fmt.Errorf("invalid dashboard UID")
	}

	return fmt.Sprintf("/d/%v", dashUID), nil
}
