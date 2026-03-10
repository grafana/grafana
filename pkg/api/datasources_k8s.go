package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
	dsconverter "github.com/grafana/grafana/pkg/registry/apis/datasource"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/web"
	"github.com/open-feature/go-sdk/openfeature"
)

// getK8sDataSourceByUIDHandler returns a handler that redirects GET /api/datasources/uid/:uid
// to /apis/<plugin-type>.datasource.grafana.app/v0alpha1/namespaces/<org>/datasources/{uid} when the feature toggle is enabled.
//
// Optional access control metadata is still fetched from the legacy accesscontrol service for now.
func (hs *HTTPServer) getK8sDataSourceByUIDHandler() web.Handler {
	return routing.Wrap(func(c *contextmodel.ReqContext) response.Response {

		// use the legacy handler if the feature toggle is disabled
		client := openfeature.NewDefaultClient()
		if !client.Boolean(c.Req.Context(), featuremgmt.FlagDatasourcesRerouteLegacyCRUDAPIs, false, openfeature.TransactionContext(c.Req.Context())) {
			return hs.GetDataSourceByUID(c)
		}

		start := time.Now()
		defer func() {
			metricutil.ObserveWithExemplar(c.Req.Context(), hs.dsConfigHandlerRequestsDuration.WithLabelValues("getK8sDataSourceByUIDHandler"), time.Since(start).Seconds())
		}()

		uid := web.Params(c.Req)[":uid"]

		// fetch the datasource type so we know which api group to call
		conns, err := hs.dsConnectionClient.GetConnectionByUID(c, uid) // nolint:staticcheck
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
