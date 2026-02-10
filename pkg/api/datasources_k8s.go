package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/api/datasource"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
		!hs.Features.IsEnabledGlobally(featuremgmt.FlagQueryServiceWithConnections) {
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
		conns, err := hs.dsConnectionClient.GetConnectionByUID(c, uid)
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

		converter := datasourceV0.NewConverter(hs.namespacer, conn.APIGroup, conn.APIVersion, []string{})
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

// TODO: there might be a place where this is handled already?
//
// handleK8sError converts K8s API errors to HTTP responses.
func (hs *HTTPServer) handleK8sError(err error) response.Response {
	statusError, ok := err.(*errors.StatusError)
	if ok {
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

// ProvideConnectionClient creates the datasource connection client.
func ProvideConnectionClient(hs *HTTPServer) datasource.ConnectionClient {
	return datasource.NewConnectionClient(hs.Cfg, hs.clientConfigProvider)
}
