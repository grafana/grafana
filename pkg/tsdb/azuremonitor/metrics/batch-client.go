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
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/utils"
)

const batchAPIVersion = "2023-10-01"

// maxConcurrentBatches limits how many Metrics Batch API requests run in parallel.
const maxConcurrentBatches = 10

// maxBatchResponseBodyBytes caps how much of a batch response body is read into
// memory, guarding against unexpectedly large or malicious responses.
const maxBatchResponseBodyBytes = 32 * 1024 * 1024 // 32 MB

// batchRequestBody is the JSON body sent in a Metrics Batch API POST request.
type batchRequestBody struct {
	ResourceIDs []string `json:"resourceids"`
}

// getRegionalEndpoint returns the Metrics Batch API hostname for the given region.
// An empty region falls back to the global endpoint.
func getRegionalEndpoint(region string) string {
	if region == "" {
		return "global.metrics.monitor.azure.com"
	}
	return fmt.Sprintf("%s.metrics.monitor.azure.com", strings.ToLower(region))
}

// buildBatchURL constructs the full URL for a Metrics Batch API POST request,
// including all query parameters derived from the batch's group key.
func buildBatchURL(batch Batch) string {
	endpoint := getRegionalEndpoint(batch.Key.Region)

	params := url.Values{}
	params.Set("api-version", batchAPIVersion)
	params.Set("metricnamespace", batch.Key.Namespace)
	params.Set("metricnames", batch.Key.MetricNames)
	params.Set("starttime", batch.Key.From)
	params.Set("endtime", batch.Key.To)
	if batch.Key.Interval != "" {
		params.Set("interval", batch.Key.Interval)
	}
	if batch.Key.Aggregation != "" {
		params.Set("aggregation", batch.Key.Aggregation)
	}
	// Only forward user-supplied dimension filters. Resource separation is handled
	// automatically by the batch API via the resourceids body parameter; adding
	// Microsoft.ResourceId here causes a 400 "invalid at Resource level" error.
	if batch.Key.DimFilter != "" {
		// Batch API uses "filter" without the "$" prefix used by the ARM API.
		params.Set("filter", strings.TrimPrefix(batch.Key.DimFilter, "$"))
	}
	if batch.Key.Top != "" {
		params.Set("top", batch.Key.Top)
	}

	return fmt.Sprintf("https://%s/subscriptions/%s/metrics:getBatch?%s",
		endpoint, url.PathEscape(batch.Key.Subscription), params.Encode())
}

// batchResponse is the top-level JSON response from the Metrics Batch API.
type batchResponse struct {
	Values []batchResponseValue `json:"values"`
}

// batchResponseValue is a per-resource entry within the batch response.
type batchResponseValue struct {
	ResourceID     string        `json:"resourceid"`
	StartTime      string        `json:"starttime"`
	EndTime        string        `json:"endtime"`
	Interval       string        `json:"interval"`
	Namespace      string        `json:"namespace"`
	ResourceRegion string        `json:"resourceregion"`
	Value          []batchMetric `json:"value"`
}

// batchMetric is a single metric within a batchResponseValue.
// It embeds the shared AzureMetricValue and adds the batch-API-specific ErrorCode field.
type batchMetric struct {
	types.AzureMetricValue
	ErrorCode string `json:"errorCode"`
}

// batchResult holds the outcome of executing a single batch request.
type batchResult struct {
	Batch    Batch
	Response *batchResponse
	Err      error
}

// executeBatchRequest sends a single Metrics Batch API request and parses the response.
func executeBatchRequest(ctx context.Context, batch Batch, cli *http.Client) (*batchResponse, error) {
	req, err := buildBatchRequest(ctx, batch)
	if err != nil {
		return nil, err
	}

	resp, err := cli.Do(req)
	if err != nil {
		return nil, backend.DownstreamError(err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxBatchResponseBodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to read batch response body: %w", err)
	}

	if resp.StatusCode/100 != 2 {
		return nil, utils.CreateResponseErrorFromStatusCode(resp.StatusCode, resp.Status, body)
	}

	var result batchResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal batch response: %w", err)
	}

	return &result, nil
}

// executeBatchRequests runs all batch requests in parallel (up to maxConcurrentBatches
// at a time) and returns one batchResult per input batch, preserving input order.
func executeBatchRequests(ctx context.Context, batches []Batch, cli *http.Client) []batchResult {
	results := make([]batchResult, len(batches))
	sem := make(chan struct{}, maxConcurrentBatches)
	var wg sync.WaitGroup
	for i, batch := range batches {
		wg.Add(1)
		sem <- struct{}{}
		go func(idx int, b Batch) {
			defer wg.Done()
			defer func() { <-sem }()
			resp, err := executeBatchRequest(ctx, b, cli)
			results[idx] = batchResult{Batch: b, Response: resp, Err: err}
		}(i, batch)
	}
	wg.Wait()
	return results
}

// buildBatchRequest creates the HTTP POST request for a Metrics Batch API call.
// The request URL carries all query parameters; the body carries the resource IDs.
func buildBatchRequest(ctx context.Context, batch Batch) (*http.Request, error) {
	rawURL := buildBatchURL(batch)

	bodyBytes, err := json.Marshal(batchRequestBody{ResourceIDs: batch.ResourceIDs})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal batch request body: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, rawURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create batch request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	return req, nil
}
