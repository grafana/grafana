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
	"strings"
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
		// Namespace format is typically "org-{orgID}"
		namespace := r.ResourceIdentifier.Namespace

		// Extract orgID from namespace for logging context
		orgID := extractOrgIDFromNamespace(namespace)
		logger = logger.With("orgID", orgID, "namespace", namespace)

		for _, dsMapping := range req.DatasourceMappings {
			dsLogger := logger.With("datasourceUID", dsMapping.UID, "datasourceType", dsMapping.Type)

			// Convert optional name pointer to string
			name := ""
			if dsMapping.Name != nil {
				name = *dsMapping.Name
				dsLogger = dsLogger.With("datasourceName", name)
			}

			// Fetch datasource from Grafana using app-platform method
			// Parameters: namespace, name (UID), group (datasource type)
			ds, err := datasourceSvc.GetDataSourceInNamespace(ctx, namespace, dsMapping.UID, dsMapping.Type)
			if err != nil {
				dsLogger.Error("Failed to get datasource from namespace", "error", err)

				// Check if it's a not found error vs other errors
				errMsg := err.Error()
				statusCode := http.StatusInternalServerError
				userMsg := fmt.Sprintf("failed to retrieve datasource: %s", dsMapping.UID)

				if strings.Contains(errMsg, "not found") || strings.Contains(errMsg, "does not exist") {
					statusCode = http.StatusNotFound
					userMsg = fmt.Sprintf("datasource not found: %s (type: %s)", dsMapping.UID, dsMapping.Type)
					dsLogger.Warn("Datasource not found in namespace")
				}

				w.WriteHeader(statusCode)
				return json.NewEncoder(w).Encode(map[string]string{
					"error": userMsg,
					"code":  "datasource_error",
				})
			}

			dsLogger.Info("Retrieved datasource", "url", ds.URL, "actualType", ds.Type)

			// Validate that the datasource type matches the expected type
			if ds.Type != dsMapping.Type {
				dsLogger.Error("Datasource type mismatch",
					"expectedType", dsMapping.Type,
					"actualType", ds.Type)
				w.WriteHeader(http.StatusBadRequest)
				return json.NewEncoder(w).Encode(map[string]string{
					"error": fmt.Sprintf("datasource %s has type %s, expected %s", dsMapping.UID, ds.Type, dsMapping.Type),
					"code":  "datasource_wrong_type",
				})
			}

			// Validate that this is a supported datasource type
			// For MVP, we only support Prometheus
			if !isSupportedDatasourceType(ds.Type) {
				dsLogger.Error("Unsupported datasource type", "type", ds.Type)
				w.WriteHeader(http.StatusBadRequest)
				return json.NewEncoder(w).Encode(map[string]string{
					"error": fmt.Sprintf("datasource type '%s' is not supported (currently only 'prometheus' is supported)", ds.Type),
					"code":  "datasource_unsupported_type",
				})
			}

			// Get authenticated HTTP transport for this datasource
			transport, err := datasourceSvc.GetHTTPTransport(ctx, ds, httpClientProvider)
			if err != nil {
				dsLogger.Error("Failed to get HTTP transport for datasource", "error", err)
				w.WriteHeader(http.StatusInternalServerError)
				return json.NewEncoder(w).Encode(map[string]string{
					"error": fmt.Sprintf("failed to configure authentication for datasource: %s", dsMapping.UID),
					"code":  "datasource_config_error",
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

			dsLogger.Debug("Datasource configured successfully for validation")
		}

		// Step 3: Validate dashboard compatibility
		result, err := validator.ValidateDashboardCompatibility(ctx, validatorReq)
		if err != nil {
			logger.Error("Validation failed", "error", err)

			// Check if it's a structured ValidationError with a specific status code
			statusCode := http.StatusInternalServerError
			errorCode := "validation_error"
			errorMsg := fmt.Sprintf("validation failed: %v", err)

			if validationErr := validator.GetValidationError(err); validationErr != nil {
				statusCode = validationErr.StatusCode
				errorCode = string(validationErr.Code)
				errorMsg = validationErr.Message

				// Log additional context from the error
				for key, value := range validationErr.Details {
					logger.Error("Validation error detail", key, value)
				}
			}

			w.WriteHeader(statusCode)
			return json.NewEncoder(w).Encode(map[string]string{
				"error": errorMsg,
				"code":  errorCode,
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

// extractOrgIDFromNamespace extracts the org ID from a namespace string
// Namespace format is typically "org-{orgID}"
func extractOrgIDFromNamespace(namespace string) string {
	parts := strings.Split(namespace, "-")
	if len(parts) >= 2 && parts[0] == "org" {
		return parts[1]
	}
	return "unknown"
}

// isSupportedDatasourceType checks if a datasource type is supported
// For MVP, we only support Prometheus
func isSupportedDatasourceType(dsType string) bool {
	supportedTypes := map[string]bool{
		"prometheus": true,
	}
	return supportedTypes[strings.ToLower(dsType)]
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
