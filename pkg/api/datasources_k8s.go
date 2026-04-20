package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/open-feature/go-sdk/openfeature"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
	dsconverter "github.com/grafana/grafana/pkg/registry/apis/datasource/converter"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

// getK8sDataSourceByUIDHandler returns a handler that redirects GET /api/datasources/uid/:uid
// to /apis/<plugin-type>.datasource.grafana.app/v0alpha1/namespaces/<org>/datasources/{uid} when the feature toggle is enabled.
//
// Optional access control metadata is still fetched from the legacy accesscontrol service for now.
func (hs *HTTPServer) getK8sDataSourceByUIDHandler() web.Handler {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !hs.Features.IsEnabledGlobally(featuremgmt.FlagDatasourcesRerouteLegacyCRUDAPIs) {
		return routing.Wrap(hs.GetDataSourceByUID)
	}

	// datasourcesRerouteLegacyCRUDAPIs requires these flags to be enabled
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !hs.Features.IsEnabledGlobally(featuremgmt.FlagQueryService) ||
		!hs.Features.IsEnabledGlobally(featuremgmt.FlagDatasourceUseNewCRUDAPIs) {
		return routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
			return response.Error(http.StatusInternalServerError,
				"datasourcesRerouteLegacyCRUDAPIs requires queryService and queryServiceWithConnections feature flags",
				nil)
		})
	}

	return routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
		start := time.Now()
		defer func() {
			metricutil.ObserveWithExemplar(c.Req.Context(), hs.dsConfigHandlerRequestsDuration.WithLabelValues("getK8sDataSourceByUIDHandler"), time.Since(start).Seconds())
		}()

		uid := web.Params(c.Req)[":uid"]

		// fetch the datasource type so we know which api group to call
		conns, err := hs.dsConnectionClient.GetConnectionByUID(c.Req.Context(), c.OrgID, uid) // nolint:staticcheck
		if err != nil {
			if strings.Contains(err.Error(), "not found") {
				return response.Error(http.StatusNotFound, "Data source not found", nil)
			}
			return response.Error(http.StatusInternalServerError, "Failed to lookup datasource connection", err)
		}

		if len(conns.Items) > 1 {
			return response.Error(http.StatusConflict, "duplicate datasource connections found with this name", nil)
		}

		conn := conns.Items[0]

		k8sDS, err := hs.getK8sDataSource(c, conn.APIGroup, conn.APIVersion, conn.Name)
		if err != nil {
			return hs.handleK8sError(err)
		}

		converter := dsconverter.NewConverter(hs.namespacer, conn.APIGroup, conn.Plugin, []string{})
		legacyDS, err := converter.AsLegacyDatasource(k8sDS)
		if err != nil {
			return hs.handleK8sError(err)
		}

		dto := hs.convertModelToDtos(c.Req.Context(), legacyDS)

		// TODO get access control from the new api endpoint too.
		dto.AccessControl = getAccessControlMetadata(c, datasources.ScopePrefix, dto.UID)

		return response.JSON(http.StatusOK, &dto)
	})
}

// getK8sDataSource fetches a datasource config from the new API
func (hs *HTTPServer) getK8sDataSource(c *contextmodel.ReqContext, group, version, uid string) (*datasourceV0.DataSource, error) {
	client, err := dynamic.NewForConfig(hs.clientConfigProvider.GetDirectRestConfig(c))
	if err != nil {
		return nil, fmt.Errorf("failed to create k8s client: %w", err)
	}

	gvr := schema.GroupVersionResource{
		Group:    group,
		Version:  version,
		Resource: "datasources",
	}

	namespace := hs.namespacer(c.GetOrgID())
	result, err := client.Resource(gvr).Namespace(namespace).Get(c.Req.Context(), uid, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	data, err := result.MarshalJSON()
	if err != nil {
		return nil, fmt.Errorf("failed to marshal datasource: %w", err)
	}

	var ds datasourceV0.DataSource
	if err := json.Unmarshal(data, &ds); err != nil {
		return nil, fmt.Errorf("failed to unmarshal datasource: %w", err)
	}

	return &ds, nil
}

// callK8sDataSourceResourceHandler returns a handler that proxies
// /api/datasources/uid/:uid/resources/* to
// /apis/<plugin-type>.datasource.grafana.app/v0alpha1/namespaces/<org>/datasources/{uid}/resources/*
// when the feature toggle is enabled.
//
// The feature flag is evaluated per-request via OpenFeature, allowing dynamic rollout.
func (hs *HTTPServer) callK8sDataSourceResourceHandler() web.Handler {
	return func(c *contextmodel.ReqContext) {
		start := time.Now()
		ctx := c.Req.Context()
		defer func() {
			metricutil.ObserveWithExemplar(ctx, hs.dsConfigHandlerRequestsDuration.WithLabelValues("callK8sDataSourceResourceHandler"), time.Since(start).Seconds())
		}()

		shouldRedirect := openfeature.NewDefaultClient().Boolean(
			ctx,
			featuremgmt.FlagDatasourcesApiserverEnableResourceEndpointRedirect,
			false,
			openfeature.TransactionContext(ctx),
		)

		if !shouldRedirect {
			hs.dsEndpointRedirects.WithLabelValues("resources", "unknown", "legacy").Inc()
			hs.CallDatasourceResourceWithUID(c)
			return
		}

		dsUID := web.Params(c.Req)[":uid"]
		if !util.IsValidShortUID(dsUID) {
			c.JsonApiErr(http.StatusBadRequest, "UID is invalid", nil)
			return
		}

		// This uses the deprecated api on purpose because we need to get the connection details for the redirect.
		// /api/ we only have the UID so we cannot use the new api until the client updates to /apis/ which will not use this
		// redirect.
		conns, err := hs.dsConnectionClient.GetConnectionByUID(c.Req.Context(), c.OrgID, dsUID) //nolint:staticcheck
		if err != nil {
			if strings.Contains(err.Error(), "not found") {
				c.JsonApiErr(http.StatusNotFound, "Data source not found", nil)
				return
			}
			c.JsonApiErr(http.StatusInternalServerError, "Failed to lookup datasource connection", err)
			return
		}

		if len(conns.Items) > 1 {
			c.JsonApiErr(http.StatusConflict, "duplicate datasource connections found with this name", nil)
			return
		}

		if len(conns.Items) == 0 {
			c.JsonApiErr(http.StatusNotFound, "Data source not found", nil)
			return
		}

		conn := conns.Items[0]
		pluginType := pluginTypeFromConnection(conn)
		hs.dsEndpointRedirects.WithLabelValues("resources", pluginType, "remote").Inc()

		namespace := hs.namespacer(c.GetOrgID())
		subPath := web.Params(c.Req)["*"]

		k8sPath := fmt.Sprintf("/apis/%s/%s/namespaces/%s/datasources/%s/resources",
			conn.APIGroup, conn.APIVersion, namespace, conn.Name)
		if subPath != "" {
			k8sPath += "/" + subPath
		}

		c.Req.URL.Path = k8sPath
		hs.clientConfigProvider.DirectlyServeHTTP(c.Resp, c.Req)
	}
}

func (hs *HTTPServer) callK8sDataSourceHealthHandler() web.Handler {
	return func(c *contextmodel.ReqContext) {
		flagEnabled, _ := openfeature.NewDefaultClient().BooleanValue(c.Req.Context(), featuremgmt.FlagDatasourcesApiServerEnableHealthEndpointRedirect, false, openfeature.TransactionContext(c.Req.Context()))

		if !flagEnabled {
			hs.dsEndpointRedirects.WithLabelValues("health", "", "legacy").Inc()
			hs.CheckDatasourceHealthWithUID(c).WriteTo(c)
			return
		}

		dsUID := web.Params(c.Req)[":uid"]
		if !util.IsValidShortUID(dsUID) {
			response.Error(http.StatusBadRequest, "UID is invalid", nil).WriteTo(c)
			return
		}

		conns, err := hs.dsConnectionClient.GetConnectionByUID(c.Req.Context(), c.OrgID, dsUID) //nolint:staticcheck
		if err != nil {
			if strings.Contains(err.Error(), "not found") {
				response.Error(http.StatusNotFound, "Data source not found", nil).WriteTo(c)
				return
			}
			response.Error(http.StatusInternalServerError, "Failed to lookup datasource connection", err).WriteTo(c)
			return
		}

		if len(conns.Items) > 1 {
			response.Error(http.StatusConflict, "duplicate datasource connections found with this name", nil).WriteTo(c)
			return
		}

		conn := conns.Items[0]
		namespace := hs.namespacer(c.GetOrgID())
		c.Req.URL.Path = fmt.Sprintf("/apis/%s/%s/namespaces/%s/datasources/%s/health", conn.APIGroup, conn.APIVersion, namespace, conn.Name)
		hs.dsEndpointRedirects.WithLabelValues("health", pluginTypeFromConnection(conn), "remote").Inc()
		hs.clientConfigProvider.DirectlyServeHTTP(c.Resp, c.Req)
	}
}

// pluginTypeFromConnection extracts the plugin type identifier from a DataSourceConnection.
// Falls back to extracting from the APIGroup (e.g. "prometheus.datasource.grafana.app" -> "prometheus").
func pluginTypeFromConnection(conn datasourceV0.DataSourceConnection) string {
	if conn.Plugin != "" {
		return conn.Plugin
	}
	if parts := strings.SplitN(conn.APIGroup, ".", 2); len(parts) > 0 {
		return parts[0]
	}
	return "unknown"
}

// handleK8sError converts K8s API errors to HTTP responses
func (hs *HTTPServer) handleK8sError(err error) response.Response {
	statusError := new(k8serrors.StatusError)

	if errors.As(err, &statusError) {
		code := int(statusError.Status().Code)
		switch code {
		case http.StatusNotFound:
			return response.Error(http.StatusNotFound, "Data source not found", nil)
		case http.StatusForbidden:
			return response.Error(http.StatusForbidden, "Access denied to datasource", err)
		default:
			return response.Error(code, statusError.Status().Message, err)
		}
	}
	return response.Error(http.StatusInternalServerError, "Failed to query datasource", err)
}
