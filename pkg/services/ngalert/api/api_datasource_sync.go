package api

import (
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/web"
)

// DatasourceSyncSrv handles the datasource sync API endpoints.
type DatasourceSyncSrv struct {
	store             store.DatasourceSyncStore
	featureManager    featuremgmt.FeatureToggles
	datasourceService datasources.DataSourceService
}

// DatasourceSyncRequest is the body for POST /api/v1/ngalert/datasource_sync.
type DatasourceSyncRequest struct {
	DatasourceUID string `json:"datasource_uid"`
	Enabled       bool   `json:"enabled"`
}

// DatasourceSyncResponse is the response body for GET/POST /api/v1/ngalert/datasource_sync.
type DatasourceSyncResponse struct {
	DatasourceUID string `json:"datasource_uid,omitempty"`
	Enabled       bool   `json:"enabled"`
	LastSyncAt    string `json:"last_sync_at,omitempty"`
	LastError     string `json:"last_error,omitempty"`
}

// RouteGetDatasourceSync handles GET /api/v1/ngalert/datasource_sync.
func (srv DatasourceSyncSrv) RouteGetDatasourceSync(c *contextmodel.ReqContext) response.Response {
	if c.GetOrgRole() != org.RoleAdmin {
		return accessForbiddenResp()
	}

	//nolint:staticcheck // not yet migrated to OpenFeature
	if !srv.featureManager.IsEnabledGlobally(featuremgmt.FlagAlertingDatasourceSync) {
		return response.Error(http.StatusNotImplemented, "Feature not enabled", nil)
	}

	sync, err := srv.store.GetDatasourceSync(c.Req.Context(), c.GetOrgID())
	if err != nil {
		if errors.Is(err, store.ErrNoDatasourceSync) {
			return response.JSON(http.StatusOK, DatasourceSyncResponse{Enabled: false})
		}
		return ErrResp(http.StatusInternalServerError, err, "failed to get datasource sync configuration")
	}

	resp := DatasourceSyncResponse{
		DatasourceUID: sync.DatasourceUID,
		Enabled:       sync.Enabled,
		LastError:     sync.LastError,
	}
	if !sync.LastSyncAt.IsZero() {
		resp.LastSyncAt = sync.LastSyncAt.UTC().Format("2006-01-02T15:04:05Z")
	}

	return response.JSON(http.StatusOK, resp)
}

// RoutePostDatasourceSync handles POST /api/v1/ngalert/datasource_sync.
func (srv DatasourceSyncSrv) RoutePostDatasourceSync(c *contextmodel.ReqContext) response.Response {
	if c.GetOrgRole() != org.RoleAdmin {
		return accessForbiddenResp()
	}

	//nolint:staticcheck // not yet migrated to OpenFeature
	if !srv.featureManager.IsEnabledGlobally(featuremgmt.FlagAlertingDatasourceSync) {
		return response.Error(http.StatusNotImplemented, "Feature not enabled", nil)
	}

	var body DatasourceSyncRequest
	if err := web.Bind(c.Req, &body); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	if body.Enabled && body.DatasourceUID == "" {
		return response.Error(http.StatusBadRequest, "datasource_uid is required when enabling sync", nil)
	}

	if body.DatasourceUID != "" {
		ds, err := srv.datasourceService.GetDataSource(c.Req.Context(), &datasources.GetDataSourceQuery{
			UID:   body.DatasourceUID,
			OrgID: c.GetOrgID(),
		})
		if err != nil {
			if errors.Is(err, datasources.ErrDataSourceNotFound) {
				return response.Error(http.StatusBadRequest, "datasource not found", err)
			}
			return ErrResp(http.StatusInternalServerError, err, "failed to look up datasource")
		}
		if ds.Type != datasources.DS_ALERTMANAGER {
			return response.Error(http.StatusBadRequest, "datasource must be of type alertmanager", nil)
		}
		impl := ds.JsonData.Get("implementation").MustString("")
		if impl != "mimir" && impl != "cortex" {
			return response.Error(http.StatusBadRequest, "datasource implementation must be mimir or cortex", nil)
		}
	}

	sync := &ngmodels.DatasourceSync{
		OrgID:         c.GetOrgID(),
		DatasourceUID: body.DatasourceUID,
		Enabled:       body.Enabled,
	}

	if err := srv.store.UpsertDatasourceSync(c.Req.Context(), sync); err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to save datasource sync configuration")
	}

	return response.JSON(http.StatusOK, DatasourceSyncResponse{
		DatasourceUID: sync.DatasourceUID,
		Enabled:       sync.Enabled,
	})
}

// registerDatasourceSyncEndpoints registers the datasource sync API routes.
func (api *API) registerDatasourceSyncEndpoints(srv *DatasourceSyncSrv, m *metrics.API) {
	api.RouteRegister.Group("", func(group routing.RouteRegister) {
		group.Get(
			toMacaronPath("/api/v1/ngalert/datasource_sync"),
			requestmeta.SetOwner(requestmeta.TeamAlerting),
			requestmeta.SetSLOGroup(requestmeta.SLOGroupHighSlow),
			api.authorize(http.MethodGet, "/api/v1/ngalert/datasource_sync"),
			metrics.Instrument(
				http.MethodGet,
				"/api/v1/ngalert/datasource_sync",
				api.Hooks.Wrap(srv.RouteGetDatasourceSync),
				m,
			),
		)
		group.Post(
			toMacaronPath("/api/v1/ngalert/datasource_sync"),
			requestmeta.SetOwner(requestmeta.TeamAlerting),
			requestmeta.SetSLOGroup(requestmeta.SLOGroupHighSlow),
			api.authorize(http.MethodPost, "/api/v1/ngalert/datasource_sync"),
			metrics.Instrument(
				http.MethodPost,
				"/api/v1/ngalert/datasource_sync",
				api.Hooks.Wrap(srv.RoutePostDatasourceSync),
				m,
			),
		)
	}, middleware.ReqSignedIn)
}
