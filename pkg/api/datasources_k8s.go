package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api/datasource"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/components/simplejson"
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
		conn, err := hs.dsConnectionClient.GetConnectionByUID(c, uid)
		if err != nil {
			if strings.Contains(err.Error(), "not found") {
				return response.Error(http.StatusNotFound, "Data source not found", nil)
			}
			return response.Error(http.StatusInternalServerError, "Failed to lookup datasource connection", err)
		}

		k8sDS, err := hs.getK8sDataSource(c, conn.Datasource.Group, conn.Datasource.Version, uid)
		if err != nil {
			return hs.handleK8sError(err)
		}

		// fetch the logo URL from the plugin store.
		var logoURL string
		pluginType := extractPluginTypeFromAPIVersion(k8sDS.APIVersion)
		if plugin, exists := hs.pluginStore.Plugin(c.Req.Context(), pluginType); exists {
			logoURL = plugin.Info.Logos.Small

		}
		legacyDTO := k8sDataSourceToLegacyDTO(k8sDS, logoURL)

		// TODO get access control from the new api endpoint too.
		legacyDTO.AccessControl = getAccessControlMetadata(c, datasources.ScopePrefix, legacyDTO.UID)

		return response.JSON(http.StatusOK, &legacyDTO)
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

// TODO: should this conversion logic live in pkg/registry/apis/datasource/converter.go?
// Maybe convert to the datasource.Datasource model and then to DTO, like the
// legacy handler?
//
// k8sDataSourceToLegacyDTO converts a datasourceV0.Datasource to the legacy dtos.DataSource format.
// logoURL is optional - there is a default icon.
func k8sDataSourceToLegacyDTO(k8sDS *datasourceV0.DataSource, logoURL string) dtos.DataSource {
	pluginType := extractPluginTypeFromAPIVersion(k8sDS.APIVersion)

	dto := dtos.DataSource{
		UID:              k8sDS.Name, // K8s uses Name for UID
		Name:             k8sDS.Spec.Title(),
		Type:             pluginType,
		TypeLogoUrl:      "public/img/icn-datasource.svg", // default icon
		Access:           datasources.DsAccess(k8sDS.Spec.Access()),
		Url:              k8sDS.Spec.URL(),
		Database:         k8sDS.Spec.Database(),
		User:             k8sDS.Spec.User(),
		BasicAuth:        k8sDS.Spec.BasicAuth(),
		BasicAuthUser:    k8sDS.Spec.BasicAuthUser(),
		WithCredentials:  k8sDS.Spec.WithCredentials(),
		IsDefault:        k8sDS.Spec.IsDefault(),
		ReadOnly:         k8sDS.Spec.ReadOnly(),
		Version:          int(k8sDS.Generation),
		SecureJsonFields: make(map[string]bool),
	}

	if k8sDS.Labels != nil {
		if idStr, ok := k8sDS.Labels[utils.LabelKeyDeprecatedInternalID]; ok {
			dto.Id, _ = strconv.ParseInt(idStr, 10, 64)
		}
	}

	if info, err := types.ParseNamespace(k8sDS.Namespace); err == nil {
		dto.OrgId = info.OrgID
	}

	if jsonData := k8sDS.Spec.JSONData(); jsonData != nil {
		dto.JsonData = simplejson.NewFromAny(jsonData)
	}

	// Only the keys are exposed, values are never returned
	for k := range k8sDS.Secure {
		dto.SecureJsonFields[k] = true
	}

	if logoURL != "" {
		dto.TypeLogoUrl = logoURL
	}

	return dto
}

// extractPluginTypeFromAPIVersion extracts the plugin type from a K8s APIVersion.
// for example: prometheus.datasource.grafana.app/v0alpha1 -> prometheus
func extractPluginTypeFromAPIVersion(apiVersion string) string {
	group := strings.Split(apiVersion, "/")[0]
	parts := strings.Split(group, ".")
	if len(parts) > 0 {
		return parts[0]
	}
	return ""
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
