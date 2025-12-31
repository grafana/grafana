package app

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"

	validatorv1alpha1 "github.com/grafana/grafana/apps/dashvalidator/pkg/apis/dashvalidator/v1alpha1"
	"github.com/grafana/grafana/apps/dashvalidator/pkg/validator"
	_ "github.com/grafana/grafana/apps/dashvalidator/pkg/validator/prometheus" // Register prometheus validator via init()
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
)

type DashValidatorConfig struct {
	DatasourceSvc      datasources.DataSourceService
	PluginCtx          *plugincontext.Provider
	HTTPClientProvider httpclient.Provider
}

// checkRequest matches the CUE schema for POST /check request
type checkRequest struct {
	DashboardJSON      map[string]interface{} `json:"dashboardJson"`
	DatasourceMappings []datasourceMapping    `json:"datasourceMappings"`
}

// datasourceMapping represents a datasource to validate against
type datasourceMapping struct {
	UID  string  `json:"uid"`
	Type string  `json:"type"`
	Name *string `json:"name,omitempty"`
}

// checkResponse matches the CUE schema for POST /check response
type checkResponse struct {
	CompatibilityScore float64            `json:"compatibilityScore"`
	DatasourceResults  []datasourceResult `json:"datasourceResults"`
}

// datasourceResult contains validation results for a single datasource
type datasourceResult struct {
	UID                string        `json:"uid"`
	Type               string        `json:"type"`
	Name               *string       `json:"name,omitempty"`
	TotalQueries       int           `json:"totalQueries"`
	CheckedQueries     int           `json:"checkedQueries"`
	TotalMetrics       int           `json:"totalMetrics"`
	FoundMetrics       int           `json:"foundMetrics"`
	MissingMetrics     []string      `json:"missingMetrics"`
	QueryBreakdown     []queryResult `json:"queryBreakdown"`
	CompatibilityScore float64       `json:"compatibilityScore"`
}

// queryResult contains validation results for a single query
type queryResult struct {
	PanelTitle         string   `json:"panelTitle"`
	PanelID            int      `json:"panelID"`
	QueryRefID         string   `json:"queryRefId"`
	TotalMetrics       int      `json:"totalMetrics"`
	FoundMetrics       int      `json:"foundMetrics"`
	MissingMetrics     []string `json:"missingMetrics"`
	CompatibilityScore float64  `json:"compatibilityScore"`
}

func New(cfg app.Config) (app.App, error) {
	specificConfig, ok := cfg.SpecificConfig.(*DashValidatorConfig)
	if !ok {
		return nil, fmt.Errorf("invalid config type: expected DashValidatorConfig")
	}

	log := logging.DefaultLogger.With("app", "dashvalidator")

	// configure our app
	simpleConfig := simple.AppConfig{
		Name:       "dashvalidator",
		KubeConfig: cfg.KubeConfig,

		//Define our custom route
		VersionedCustomRoutes: map[string]simple.AppVersionRouteHandlers{
			"v1alpha1": {
				{
					Namespaced: true,
					Path:       "check",
					Method:     "POST",
				}: handleCheckRoute(log, specificConfig.DatasourceSvc, specificConfig.PluginCtx, specificConfig.HTTPClientProvider),
			},
		},
	}

	a, err := simple.NewApp(simpleConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create app: %w", err)
	}

	return a, nil
}

// custom route handler to check dashboard compatibility
func handleCheckRoute(
	log logging.Logger,
	datasourceSvc datasources.DataSourceService,
	pluginCtx *plugincontext.Provider,
	httpClientProvider httpclient.Provider,
) func(context.Context, app.CustomRouteResponseWriter, *app.CustomRouteRequest) error {

	return func(ctx context.Context, w app.CustomRouteResponseWriter, r *app.CustomRouteRequest) error {
		logger := log.WithContext(ctx)
		logger.Info("Received compatibility check request")

		// Step 1: Parse request body
		body, err := io.ReadAll(r.Body)
		if err != nil {
			logger.Error("Failed to read request body", "error", err)
			w.WriteHeader(http.StatusBadRequest)
			return json.NewEncoder(w).Encode(map[string]string{
				"error": "failed to read request body",
			})
		}

		var req checkRequest
		if err := json.Unmarshal(body, &req); err != nil {
			logger.Error("Failed to parse request JSON", "error", err)
			w.WriteHeader(http.StatusBadRequest)
			return json.NewEncoder(w).Encode(map[string]string{
				"error": "invalid JSON in request body",
			})
		}

		// Step 2: Build validator request
		validatorReq := validator.DashboardCompatibilityRequest{
			DashboardJSON:      req.DashboardJSON,
			DatasourceMappings: make([]validator.DatasourceMapping, 0, len(req.DatasourceMappings)),
		}

		logger.Info("Processing request", "dashboardTitle", req.DashboardJSON["title"], "numMappings", len(req.DatasourceMappings))

		// Get namespace from request (needed for datasource lookup)
		namespace := r.ResourceIdentifier.Namespace

		for _, dsMapping := range req.DatasourceMappings {
			// Convert optional name pointer to string
			name := ""
			if dsMapping.Name != nil {
				name = *dsMapping.Name
			}

			// Fetch datasource from Grafana using app-platform method
			// Parameters: namespace, name (UID), group (datasource type)
			ds, err := datasourceSvc.GetDataSourceInNamespace(ctx, namespace, dsMapping.UID, dsMapping.Type)
			if err != nil {
				logger.Error("Failed to get datasource", "namespace", namespace, "uid", dsMapping.UID, "type", dsMapping.Type, "error", err)
				w.WriteHeader(http.StatusBadRequest)
				return json.NewEncoder(w).Encode(map[string]string{
					"error": fmt.Sprintf("datasource not found: %s", dsMapping.UID),
				})
			}

			logger.Info("Retrieved datasource", "uid", ds.UID, "url", ds.URL, "type", ds.Type)

			// Get authenticated HTTP transport for this datasource
			transport, err := datasourceSvc.GetHTTPTransport(ctx, ds, httpClientProvider)
			if err != nil {
				logger.Error("Failed to get HTTP transport", "uid", ds.UID, "error", err)
				w.WriteHeader(http.StatusInternalServerError)
				return json.NewEncoder(w).Encode(map[string]string{
					"error": fmt.Sprintf("failed to configure datasource transport: %s", dsMapping.UID),
				})
			}

			// Create HTTP client with authenticated transport
			httpClient := &http.Client{
				Transport: transport,
			}

			validatorReq.DatasourceMappings = append(validatorReq.DatasourceMappings, validator.DatasourceMapping{
				UID:        dsMapping.UID,
				Type:       dsMapping.Type,
				Name:       name,
				URL:        ds.URL,
				HTTPClient: httpClient, // Pass authenticated client
			})
		}

		// Step 3: Validate dashboard compatibility
		result, err := validator.ValidateDashboardCompatibility(ctx, validatorReq)
		if err != nil {
			logger.Error("Validation failed", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			return json.NewEncoder(w).Encode(map[string]string{
				"error": fmt.Sprintf("validation failed: %v", err),
			})
		}

		// Step 4: Convert result to response format
		response := convertToCheckResponse(result)

		// Step 5: Return response
		w.WriteHeader(http.StatusOK)
		return json.NewEncoder(w).Encode(response)
	}
}

// convertToCheckResponse converts validator result to API response format
func convertToCheckResponse(result *validator.DashboardCompatibilityResult) checkResponse {
	response := checkResponse{
		CompatibilityScore: result.CompatibilityScore,
		DatasourceResults:  make([]datasourceResult, 0, len(result.DatasourceResults)),
	}

	for _, dsResult := range result.DatasourceResults {
		// Convert name string to pointer
		var name *string
		if dsResult.Name != "" {
			name = &dsResult.Name
		}

		// Convert query results
		queryBreakdown := make([]queryResult, 0, len(dsResult.QueryBreakdown))
		for _, qr := range dsResult.QueryBreakdown {
			queryBreakdown = append(queryBreakdown, queryResult{
				PanelTitle:         qr.PanelTitle,
				PanelID:            qr.PanelID,
				QueryRefID:         qr.QueryRefID,
				TotalMetrics:       qr.TotalMetrics,
				FoundMetrics:       qr.FoundMetrics,
				MissingMetrics:     qr.MissingMetrics,
				CompatibilityScore: qr.CompatibilityScore,
			})
		}

		response.DatasourceResults = append(response.DatasourceResults, datasourceResult{
			UID:                dsResult.UID,
			Type:               dsResult.Type,
			Name:               name,
			TotalQueries:       dsResult.TotalQueries,
			CheckedQueries:     dsResult.CheckedQueries,
			TotalMetrics:       dsResult.TotalMetrics,
			FoundMetrics:       dsResult.FoundMetrics,
			MissingMetrics:     dsResult.MissingMetrics,
			QueryBreakdown:     queryBreakdown,
			CompatibilityScore: dsResult.CompatibilityScore,
		})
	}

	return response
}

func GetKinds() map[schema.GroupVersion][]resource.Kind {
	gv := schema.GroupVersion{
		Group:   "dashvalidator.grafana.com",
		Version: "v1alpha1",
	}

	return map[schema.GroupVersion][]resource.Kind{
		gv: {validatorv1alpha1.DashboardCompatibilityScoreKind()},
	}
}
