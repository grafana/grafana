package metrics

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/utils"
)

const BatchAPIVersion = "2023-10-01"

// executeBatchQuery executes a batch query against the Azure Monitor Batch API
func (e *AzureMonitorDatasource) executeBatchQuery(ctx context.Context, batch *types.BatchQueryGroup, dsInfo types.DatasourceInfo, client *http.Client) (*types.AzureMonitorBatchResponse, error) {
	batchURL := buildBatchURL(batch.Region, batch.Subscription, batch.Namespace, batch)
	requestBody := types.AzureMonitorBatchRequest{
		ResourceIds: batch.ResourceIds,
	}

	bodyJSON, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal batch request: %w", err)
	}

	// Create the HTTP request
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, batchURL, bytes.NewBuffer(bodyJSON))
	if err != nil {
		return nil, fmt.Errorf("failed to create batch request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	_, span := tracing.DefaultTracer().Start(ctx, "azuremonitor batch query", trace.WithAttributes(
		attribute.String("region", batch.Region),
		attribute.String("namespace", batch.Namespace),
		attribute.Int("resource_count", len(batch.ResourceIds)),
		attribute.Int64("datasource_id", dsInfo.DatasourceID),
		attribute.Int64("org_id", dsInfo.OrgID),
	))
	defer span.End()

	res, err := client.Do(req)
	if err != nil {
		return nil, backend.DownstreamError(fmt.Errorf("batch query failed: %w", err))
	}

	defer func() {
		if err := res.Body.Close(); err != nil {
			e.Logger.Warn("Failed to close batch response body", "err", err)
		}
	}()

	// Read the response
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read batch response: %w", err)
	}

	if res.StatusCode/100 != 2 {
		return nil, utils.CreateResponseErrorFromStatusCode(res.StatusCode, res.Status, body)
	}

	// Parse the response
	var batchResponse types.AzureMonitorBatchResponse
	err = json.Unmarshal(body, &batchResponse)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal batch response: %w", err)
	}

	return &batchResponse, nil
}

// buildBatchURL constructs the batch API URL with query parameters
func buildBatchURL(region, subscriptionID, namespace string, batch *types.BatchQueryGroup) string {
	endpoint := getRegionalEndpoint(region)

	// Build query parameters
	query := url.Values{}
	query.Add("api-version", BatchAPIVersion)
	query.Add("metricnamespace", namespace)
	query.Add("metricnames", strings.Join(batch.MetricNames, ","))
	query.Add("starttime", batch.TimeRange.From.UTC().Format(time.RFC3339))
	query.Add("endtime", batch.TimeRange.To.UTC().Format(time.RFC3339))

	if batch.Interval != "" {
		query.Add("interval", batch.Interval)
	}

	if batch.Aggregation != "" {
		query.Add("aggregation", batch.Aggregation)
	}

	if batch.Filter != "" {
		// Remove $ prefix if present (batch API doesn't use it)
		filter := strings.TrimPrefix(batch.Filter, "$")
		query.Add("filter", filter)
	}

	if batch.Top != "" {
		query.Add("top", batch.Top)
	}

	if batch.OrderBy != "" {
		query.Add("orderby", batch.OrderBy)
	}

	return fmt.Sprintf("https://%s/subscriptions/%s/metrics:getBatch?%s",
		endpoint, subscriptionID, query.Encode())
}

// getRegionalEndpoint returns the regional metrics endpoint for the given region
func getRegionalEndpoint(region string) string {
	// Handle empty or global resources
	if region == "" || strings.EqualFold(region, "global") {
		return "global.metrics.monitor.azure.com"
	}

	// Normalize region (lowercase, remove spaces)
	normalizedRegion := strings.ToLower(strings.ReplaceAll(region, " ", ""))

	return fmt.Sprintf("%s.metrics.monitor.azure.com", normalizedRegion)
}

// isBatchableQuery determines if a query can use the batch API
func isBatchableQuery(query *types.AzureMonitorQuery) bool {
	// Batch API doesn't support custom metrics or guest OS metrics
	namespace := query.Params.Get("metricnamespace")

	// Check for custom metrics namespace
	if strings.Contains(strings.ToLower(namespace), "custom") {
		return false
	}

	// Check for guest OS metrics
	if strings.Contains(strings.ToLower(namespace), "guest") {
		return false
	}

	// Single resource queries can use batch API too
	// Multiple resource queries definitely benefit from batch API
	return true
}
