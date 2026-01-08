package elasticsearch

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

const ErrorBodyMaxSize = 200

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	logger := s.logger.FromContext(ctx)

	ds, err := s.getDSInfo(ctx, req.PluginContext)
	if err != nil {
		logger.Error("Failed to get data source info", "error", err)
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusUnknown,
			Message: "Health check failed: Failed to get data source info",
		}, nil
	}

	healthStatusUrl, err := url.Parse(ds.URL)
	if err != nil {
		logger.Error("Failed to parse data source URL", "error", err)
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusUnknown,
			Message: "Failed to parse data source URL",
		}, nil
	}

	// check that ES is healthy
	healthStatusUrl.Path = path.Join(healthStatusUrl.Path, "_cluster/health")
	healthStatusUrl.RawQuery = "wait_for_status=yellow"

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, healthStatusUrl.String(), nil)
	if err != nil {
		logger.Error("Failed to create request", "error", err, "url", healthStatusUrl.String())
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusUnknown,
			Message: "Failed to create request",
		}, nil
	}

	start := time.Now()
	logger.Debug("Sending healthcheck request to Elasticsearch", "url", healthStatusUrl.String())
	response, err := ds.HTTPClient.Do(request)

	if err != nil {
		logger.Error("Failed to connect to Elasticsearch", "error", err, "url", healthStatusUrl.String())
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "Health check failed: Failed to connect to Elasticsearch",
		}, nil
	}

	if response.StatusCode == http.StatusRequestTimeout {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "Health check failed: Elasticsearch data source is not healthy. Request timed out",
		}, nil
	}

	if response.StatusCode >= 400 {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: fmt.Sprintf("Health check failed: Elasticsearch data source is not healthy. Status: %s", response.Status),
		}, nil
	}

	logger.Info("Response received from Elasticsearch", "statusCode", response.StatusCode, "status", "ok", "duration", time.Since(start))

	defer func() {
		if err := response.Body.Close(); err != nil {
			logger.Warn("Failed to close response body", "error", err)
		}
	}()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		logger.Error("Error reading response body bytes", "error", err)
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusUnknown,
			Message: "Health check failed: Failed to read response",
		}, nil
	}

	jsonData := map[string]any{}

	err = json.Unmarshal(body, &jsonData)
	if err != nil {
		truncatedBody := string(body)
		if len(truncatedBody) > ErrorBodyMaxSize {
			truncatedBody = truncatedBody[:ErrorBodyMaxSize] + "..."
		}
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusUnknown,
			Message: fmt.Sprintf("Health check failed: Failed to parse response from Elasticsearch. Response received: %s", truncatedBody),
		}, nil
	}

	if jsonData["status"] == "red" {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "Health check failed: Elasticsearch data source is not healthy",
		}, nil
	}

	successMessage := "Elasticsearch data source is healthy."
	indexWarningMessage := ""

	// validate index and time field
	cfg := backend.GrafanaConfigFromContext(ctx)
	crossClusterSearchEnabled := cfg.FeatureToggles().IsEnabled("elasticsearchCrossClusterSearch")

	if crossClusterSearchEnabled {
		message, level := validateIndex(ctx, ds)
		if level == "warning" {
			indexWarningMessage = message
		}
		if level == "error" {
			return &backend.CheckHealthResult{
				Status:  backend.HealthStatusError,
				Message: message,
			}, nil
		}
	}

	if indexWarningMessage != "" {
		successMessage = fmt.Sprintf("%s Warning: %s", successMessage, indexWarningMessage)
	}

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: successMessage,
	}, nil
}

func validateIndex(ctx context.Context, ds *es.DatasourceInfo) (message string, level string) {
	// validate that the index exist and has date field
	ip, err := es.NewIndexPattern(ds.Interval, ds.Database)
	if err != nil {
		return fmt.Sprintf("Failed to get build index pattern: %s", err), "error"
	}

	indices, err := ip.GetIndices(backend.TimeRange{
		From: time.Now().UTC(),
		To:   time.Now().UTC(),
	})
	if err != nil {
		return fmt.Sprintf("Failed to get index pattern: %s", err), "error"
	}

	indexList := strings.Join(indices, ",")

	validateUrl := fmt.Sprintf("%s/%s/_field_caps?fields=%s", ds.URL, indexList, ds.ConfiguredFields.TimeField)
	if indexList == "" || strings.ReplaceAll(indexList, ",", "") == "" {
		validateUrl = fmt.Sprintf("%s/_field_caps?fields=%s", ds.URL, ds.ConfiguredFields.TimeField)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, validateUrl, nil)
	if err != nil {
		return fmt.Sprint("Failed to create request", "error", err, "url", validateUrl), "error"
	}
	response, err := ds.HTTPClient.Do(request)
	if err != nil {
		return fmt.Sprint("Failed to fetch field capabilities", "error", err, "url", validateUrl), "error"
	}
	defer func() {
		if err := response.Body.Close(); err != nil {
			backend.Logger.Warn("Failed to close response body", "error", err)
		}
	}()

	fieldCaps := map[string]any{}
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return "Could not read response body while checking time field", "error"
	}
	err = json.Unmarshal(body, &fieldCaps)
	if err != nil {
		return "Failed to unmarshal field capabilities response", "error"
	}
	if fieldCaps["error"] != nil {
		errorMap, ok := fieldCaps["error"].(map[string]any)
		if !ok {
			return "Error validating index", "warning"
		}
		errorMessage, ok := errorMap["reason"].(string)
		if !ok {
			return "Error validating index", "warning"
		}
		return fmt.Sprintf("Error validating index: %s", errorMessage), "warning"
	}

	fields, ok := fieldCaps["fields"].(map[string]any)
	if !ok {
		return "Failed to parse fields from response", "error"
	}
	if len(fields) == 0 {
		return fmt.Sprintf("Could not find field %s in index", ds.ConfiguredFields.TimeField), "warning"
	}

	timeFieldInfo, ok := fields[ds.ConfiguredFields.TimeField].(map[string]any)
	if !ok {
		return "Failed to parse time field info from response", "error"
	}

	dateTypeField, ok := timeFieldInfo["date"].(map[string]any)
	if !ok || dateTypeField == nil {
		return fmt.Sprintf("Could not find time field '%s' with type date in index", ds.ConfiguredFields.TimeField), "warning"
	}

	return "", ""
}
