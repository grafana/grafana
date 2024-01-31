package elasticsearch

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"path"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	logger := eslog.FromContext(ctx)

	ds, err := s.getDSInfo(ctx, req.PluginContext)
	if err != nil {
		logger.Error("Failed to get data source info", "error", err)
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusUnknown,
			Message: "Failed to get data source info",
		}, err
	}

	esUrl, err := url.Parse(ds.URL)
	if err != nil {
		logger.Error("Failed to parse data source URL", "error", err, "url", ds.URL)
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusUnknown,
			Message: "Failed to parse data source URL",
		}, err
	}

	esUrl.Path = path.Join(esUrl.Path, "_cluster/health")
	esUrl.RawQuery = "wait_for_status=yellow"

	request, err := http.NewRequestWithContext(ctx, "GET", esUrl.String(), nil)
	if err != nil {
		logger.Error("Failed to create request", "error", err, "url", esUrl.String())
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusUnknown,
			Message: "Failed to create request",
		}, err
	}

	logger.Debug("Sending health request to Elasticsearch")
	response, err := ds.HTTPClient.Do(request)

	if err != nil {
		logger.Error("Failed to Do request", "error", err, "url", esUrl.String())
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusUnknown,
			Message: "Failed to Do request",
		}, err
	}

	if response.StatusCode == http.StatusRequestTimeout {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "Elasticsearch cluster is not healthy",
		}, nil
	}

	logger.Info("Response received from Elasticsearch", "statusCode", response.StatusCode, "status", "ok")

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
			Message: "Failed to read response",
		}, err
	}

	jsonData := map[string]any{}

	err = json.Unmarshal(body, &jsonData)
	if err != nil {
		logger.Error("Error during json unmarshal of the body", "error", err)
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusUnknown,
			Message: "Failed to unmarshal response",
		}, err
	}

	status := backend.HealthStatusOk
	message := "Elasticsearch cluster is healthy"

	if jsonData["status"] == "red" {
		status = backend.HealthStatusError
		message = "Elasticsearch cluster is not healthy"
	}

	return &backend.CheckHealthResult{
		Status:  status,
		Message: message,
	}, nil
}
