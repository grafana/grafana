package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/apps/dashvalidator/pkg/cache"
	"github.com/grafana/grafana/apps/dashvalidator/pkg/validator"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/util"
)

type DashValidatorConfig struct {
	DatasourceSvc      datasources.DataSourceService
	HTTPClientProvider httpclient.Provider
	MetricsCache       *cache.MetricsCache                      // Injected by register.go
	Validators         map[string]validator.DatasourceValidator // Injected by register.go, keyed by datasource type
	AC                 accesscontrol.AccessControl              // For per-datasource scoped permission checks
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
	ParseError         *string  `json:"parseError,omitempty"`
}

func New(cfg app.Config) (app.App, error) {
	specificConfig, ok := cfg.SpecificConfig.(*DashValidatorConfig)
	if !ok {
		return nil, fmt.Errorf("invalid config type: expected DashValidatorConfig")
	}

	log := logging.DefaultLogger.With("app", "dashvalidator")

	// MetricsCache and Validators are created by register.go and passed via config
	metricsCache := specificConfig.MetricsCache
	validators := specificConfig.Validators

	log.Info("Initialized dashvalidator app", "numValidators", len(validators))

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
				}: handleCheckRoute(log, specificConfig.DatasourceSvc, specificConfig.HTTPClientProvider, validators, specificConfig.AC),
			},
		},
	}

	a, err := simple.NewApp(simpleConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create app: %w", err)
	}

	// Register MetricsCache as a runnable so its cleanup goroutine is managed by the app lifecycle
	a.AddRunnable(metricsCache)

	return a, nil
}

// custom route handler to check dashboard compatibility
func handleCheckRoute(
	log logging.Logger,
	datasourceSvc datasources.DataSourceService,
	httpClientProvider httpclient.Provider,
	validators map[string]validator.DatasourceValidator,
	ac accesscontrol.AccessControl,
) func(context.Context, app.CustomRouteResponseWriter, *app.CustomRouteRequest) error {
	return func(ctx context.Context, w app.CustomRouteResponseWriter, r *app.CustomRouteRequest) error {
		// Set a timeout for the entire request processing
		// This prevents the handler from hanging indefinitely on slow external services
		const requestTimeout = 30 * time.Second
		ctx, cancel := context.WithTimeout(ctx, requestTimeout)
		defer cancel()

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

		// MVP: Only support single datasource validation
		if len(req.DatasourceMappings) != 1 {
			logger.Error("MVP only supports single datasource validation", "numDatasources", len(req.DatasourceMappings))
			w.WriteHeader(http.StatusBadRequest)
			return json.NewEncoder(w).Encode(map[string]string{
				"error": fmt.Sprintf("MVP only supports single datasource validation, got %d datasources", len(req.DatasourceMappings)),
				"code":  "invalid_request",
			})
		}

		// Validate datasource mapping fields
		for i, dsMapping := range req.DatasourceMappings {
			// Validate UID using Grafana's standard validation
			// Checks: not empty, max 40 chars, valid characters (a-zA-Z0-9-_)
			if err := util.ValidateUID(dsMapping.UID); err != nil {
				logger.Error("Datasource UID validation failed",
					"index", i,
					"uid", dsMapping.UID,
					"error", err)
				w.WriteHeader(http.StatusBadRequest)
				return json.NewEncoder(w).Encode(map[string]string{
					"error": fmt.Sprintf("invalid datasource UID: %v", err),
					"code":  "invalid_datasource_uid",
				})
			}

			// Validate type is not empty
			if len(dsMapping.Type) == 0 {
				logger.Error("Datasource type is empty", "index", i)
				w.WriteHeader(http.StatusBadRequest)
				return json.NewEncoder(w).Encode(map[string]string{
					"error": "datasource type cannot be empty",
					"code":  "invalid_datasource_type",
				})
			}
		}

		// Step 2: Build validator request
		validatorReq := validator.DashboardCompatibilityRequest{
			DashboardJSON: req.DashboardJSON,
			Datasources:   make([]validator.Datasource, 0, len(req.DatasourceMappings)),
		}

		logger.Info("Processing request", "dashboardTitle", req.DashboardJSON["title"], "numMappings", len(req.DatasourceMappings))

		// Get namespace from request (needed for datasource lookup)
		// Namespace format is typically "org-{orgID}"
		namespace := r.ResourceIdentifier.Namespace

		// Extract orgID from namespace for logging context
		orgID, err := getOrgIDFromNamespace(namespace)
		if err != nil {
			logger.Warn("Failed to parse namespace for orgID",
				"namespace", namespace,
				"error", err,
			)
		}
		logger = logger.With("orgID", orgID, "namespace", namespace)

		// Extract the requester once for per-datasource scoped permission checks
		user, err := identity.GetRequester(ctx)
		if err != nil {
			logger.Error("Failed to get requester from context", "error", err)
			w.WriteHeader(http.StatusUnauthorized)
			return json.NewEncoder(w).Encode(map[string]string{
				"error": "authentication required",
				"code":  "auth_error",
			})
		}

		for _, dsMapping := range req.DatasourceMappings {
			dsLogger := logger.With("datasourceUID", dsMapping.UID, "datasourceType", dsMapping.Type)

			// Verify user has read/query access to this specific datasource
			dsScope := datasources.ScopeProvider.GetResourceScopeUID(dsMapping.UID)
			dsEvaluator := accesscontrol.EvalAll(
				accesscontrol.EvalPermission(datasources.ActionRead, dsScope),
				accesscontrol.EvalPermission(datasources.ActionQuery, dsScope),
			)
			hasAccess, err := ac.Evaluate(ctx, user, dsEvaluator)
			if err != nil {
				dsLogger.Error("Failed to evaluate datasource permissions", "error", err)
				w.WriteHeader(http.StatusInternalServerError)
				return json.NewEncoder(w).Encode(map[string]string{
					"error": "permission check failed",
					"code":  "auth_error",
				})
			}
			if !hasAccess {
				dsLogger.Warn("User lacks permission for datasource")
				w.WriteHeader(http.StatusForbidden)
				return json.NewEncoder(w).Encode(map[string]string{
					"error": fmt.Sprintf("insufficient permissions for datasource: %s", dsMapping.UID),
					"code":  "datasource_forbidden",
				})
			}

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

				// Check if it's a not found error vs other errors using proper type checking
				statusCode := http.StatusInternalServerError
				userMsg := fmt.Sprintf("failed to retrieve datasource: %s", dsMapping.UID)

				if errors.Is(err, datasources.ErrDataSourceNotFound) {
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
			// Supported types are determined by the validators map (single source of truth)
			if _, supported := validators[ds.Type]; !supported {
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

			// Create HTTP client with authenticated transport and timeout
			// The timeout acts as a safety net if context timeout isn't propagated
			httpClient := &http.Client{
				Transport: transport,
				Timeout:   30 * time.Second,
			}

			validatorReq.Datasources = append(validatorReq.Datasources, validator.Datasource{
				UID:        dsMapping.UID,
				Type:       dsMapping.Type,
				Name:       name,
				URL:        ds.URL,
				HTTPClient: httpClient, // Pass authenticated client
			})

			dsLogger.Debug("Datasource configured successfully for validation")
		}

		// Step 3: Validate dashboard compatibility
		result, err := validator.ValidateDashboardCompatibility(ctx, validatorReq, validators)
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
				ParseError:         qr.ParseError,
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

// getOrgIDFromNamespace extracts the org ID from a namespace using the standard authlib parser.
func getOrgIDFromNamespace(namespace string) (int64, error) {
	info, err := types.ParseNamespace(namespace)
	if err != nil {
		return 0, fmt.Errorf("failed to parse namespace %s: %w", namespace, err)
	}
	return info.OrgID, nil
}

func GetKinds() map[schema.GroupVersion][]resource.Kind {
	return map[schema.GroupVersion][]resource.Kind{}
}
