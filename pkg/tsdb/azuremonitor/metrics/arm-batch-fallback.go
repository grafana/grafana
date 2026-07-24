package metrics

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/kinds/dataquery"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/utils"
)

// The Azure Portal batch endpoint (ARM /batch) is used as the fallback when the
// metrics:getBatch data-plane API fails with a retryable error, wrapping each
// per-resource /metrics GET call as a sub-request.
const armBatchAPIVersion = "2020-06-01"

// maxARMBatchSize bounds sub-requests per ARM batch call. Above ~20 sub-requests the
// endpoint switches to an async 202 + Location/poll flow; we stay at or under that to
// keep a single synchronous response. The exact async threshold is unverified, so this
// is deliberately conservative.
const maxARMBatchSize = 20

// armBatchSubRequest is one ARM read inside a batch. name is a correlation id echoed back
// in the response; url is relative (begins with "/subscriptions/...") and includes the
// inner api-version.
type armBatchSubRequest struct {
	HTTPMethod string `json:"httpMethod"`
	Name       string `json:"name"`
	URL        string `json:"url"`
}

type armBatchRequestBody struct {
	Requests []armBatchSubRequest `json:"requests"`
}

// armBatchSubResponse is one result. The envelope's top-level key is "responses"; each item
// carries its own httpStatusCode and the inner response body nested under "content".
type armBatchSubResponse struct {
	Name           string          `json:"name"`
	HTTPStatusCode int             `json:"httpStatusCode"`
	Content        json.RawMessage `json:"content"`
}

type armBatchResponseBody struct {
	Responses []armBatchSubResponse `json:"responses"`
}

// executeARMBatch POSTs a set of sub-requests to the ARM /batch endpoint and returns the
// parsed per-sub-request responses.
func executeARMBatch(ctx context.Context, cli *http.Client, armBaseURL string, subRequests []armBatchSubRequest) (*armBatchResponseBody, error) {
	body, err := json.Marshal(armBatchRequestBody{Requests: subRequests})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal ARM batch request: %w", err)
	}

	rawURL := fmt.Sprintf("%s/batch?api-version=%s", strings.TrimRight(armBaseURL, "/"), armBatchAPIVersion)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, rawURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create ARM batch request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := cli.Do(req)
	if err != nil {
		return nil, backend.DownstreamError(err)
	}
	defer func() { _ = resp.Body.Close() }()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, maxBatchResponseBodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to read ARM batch response body: %w", err)
	}

	// A 202 means we exceeded the synchronous threshold and would need to poll the
	// Location header. We don't implement async polling; callers chunk to maxARMBatchSize
	// to stay under the threshold, so treat a 202 as an error.
	if resp.StatusCode == http.StatusAccepted {
		return nil, fmt.Errorf("ARM batch returned 202 Accepted (async); async polling is not implemented")
	}
	if resp.StatusCode/100 != 2 {
		return nil, utils.CreateResponseErrorFromStatusCode(resp.StatusCode, resp.Status, respBody)
	}

	var parsed armBatchResponseBody
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return nil, fmt.Errorf("failed to unmarshal ARM batch response: %w", err)
	}
	return &parsed, nil
}

// buildFallbackSubRequests rebuilds per-resource /metrics GET sub-requests for the
// resources in a single failed batch. It reuses fanOutByResource + buildQuery so the URL
// and params (dimensions, namespace, time range, etc.) come from the same proven code the
// legacy path uses; nothing is hand-reconstructed. Returns the sub-requests and a map
// from each sub-request name to its originating query RefID, for routing the responses.
//
// Only the failed batch's own ResourceIDs are rebuilt, so resources that succeeded in
// sibling batches are never re-fetched.
func (e *AzureMonitorDatasource) buildFallbackSubRequests(batch Batch, originalByRefID map[string]backend.DataQuery, dsInfo types.DatasourceInfo) ([]armBatchSubRequest, map[string][]*types.AzureMonitorQuery, error) {
	wanted := make(map[string]bool, len(batch.ResourceIDs))
	for _, id := range batch.ResourceIDs {
		wanted[strings.ToLower(id)] = true
	}

	var subRequests []armBatchSubRequest
	// A resource can be owned by more than one query (the batch group key
	// excludes RefID), so each sub-request name maps to ALL owning queries —
	// every owner's refID must receive the recovered frames.
	queriesByName := make(map[string][]*types.AzureMonitorQuery)
	nameByResource := make(map[string]string)

	for _, q := range batch.Queries {
		original, ok := originalByRefID[q.RefID]
		if !ok {
			continue
		}
		var model dataquery.AzureMonitorQuery
		if err := json.Unmarshal(original.JSON, &model); err != nil {
			return nil, nil, err
		}
		perResourceQueries, err := fanOutByResource(original, model)
		if err != nil {
			return nil, nil, err
		}
		for _, prq := range perResourceQueries {
			azureQuery, err := e.buildQuery(prq, dsInfo)
			if err != nil {
				return nil, nil, err
			}
			for resourceURI := range azureQuery.Resources {
				key := strings.ToLower(resourceURI)
				if !wanted[key] {
					continue
				}
				if name, ok := nameByResource[key]; ok {
					// The resource already has a sub-request; register this query
					// as an additional owner so its refID also receives frames.
					queriesByName[name] = append(queriesByName[name], azureQuery)
					continue
				}
				// Correlation name echoed back in the response. The refID alone is
				// not unique here (one sub-request per resource of a query), so
				// suffix it with the sub-request index.
				name := fmt.Sprintf("%s-%d", azureQuery.RefID, len(subRequests))
				nameByResource[key] = name
				queriesByName[name] = []*types.AzureMonitorQuery{azureQuery}
				subRequests = append(subRequests, armBatchSubRequest{
					HTTPMethod: http.MethodGet,
					Name:       name,
					URL:        relativeMetricsURL(azureQuery),
				})
			}
		}
	}
	return subRequests, queriesByName, nil
}

// parseFallbackResponse converts an ARM /batch response into frames. Each sub-response's
// content is a standard single-resource AzureMonitorResponse, so it's run through the
// existing parseResponse; frames are routed back to every owning query via the per-name
// query map. Failures are returned joined per refID so an error on one query's resource
// never marks a sibling query failed; frames from resources that succeeded are still returned.
func (e *AzureMonitorDatasource) parseFallbackResponse(resp *armBatchResponseBody, queriesByName map[string][]*types.AzureMonitorQuery, azurePortalURL string, subscription string) (data.Frames, map[string]error) {
	var frames data.Frames
	errsByRefID := make(map[string][]error)

	for _, r := range resp.Responses {
		queries, ok := queriesByName[r.Name]
		if !ok {
			// Should not happen: sub-request names are generated by us and echoed
			// back. Log so a request/response mismatch is diagnosable rather than
			// silently showing up as missing data.
			e.Logger.Warn("ARM /batch fallback response contained an unknown sub-request name; skipping", "name", r.Name)
			continue
		}
		if r.HTTPStatusCode/100 != 2 {
			for _, query := range queries {
				errsByRefID[query.RefID] = append(errsByRefID[query.RefID],
					fmt.Errorf("fallback query %q failed (status %d): %s", query.RefID, r.HTTPStatusCode, string(r.Content)))
			}
			continue
		}

		var amr types.AzureMonitorResponse
		if err := json.Unmarshal(r.Content, &amr); err != nil {
			for _, query := range queries {
				errsByRefID[query.RefID] = append(errsByRefID[query.RefID],
					fmt.Errorf("failed to parse fallback response for %q: %w", query.RefID, err))
			}
			continue
		}

		// Reuse the single-resource parser once per owning query so each refID
		// gets its own frames with its own alias/legend formatting. subscription
		// is the resolved display name, matching the primary batch path.
		for _, query := range queries {
			f, err := e.parseResponse(amr, query, azurePortalURL, subscription)
			if err != nil {
				errsByRefID[query.RefID] = append(errsByRefID[query.RefID], err)
				continue
			}
			frames = append(frames, f...)
		}
	}

	joined := make(map[string]error, len(errsByRefID))
	for refID, errs := range errsByRefID {
		joined[refID] = errors.Join(errs...)
	}
	return frames, joined
}

// relativeMetricsURL renders a single-resource AzureMonitorQuery as the relative URL for
// an ARM /batch sub-request. This is exactly what executeQuery would send for that query
// (path + params buildQuery already populated: api-version, timespan, metricnames,
// aggregation, and any dimension $filter); we just wrap it in a batch instead of GETting
// it directly.
func relativeMetricsURL(query *types.AzureMonitorQuery) string {
	path := query.URL
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	if encoded := query.Params.Encode(); encoded != "" {
		return path + "?" + encoded
	}
	return path
}

// isRetryableStatus reports whether a failed metrics:getBatch request is worth retrying
// via the fallback path. Throttling (429) and transient server errors (5xx, which
// includes Azure's 529 metrics throttle) are retryable; a status of 0 means the request
// never completed (e.g. a network error) and is also retryable. Other 4xx are client
// errors a retry won't fix, so they are surfaced as-is.
func isRetryableStatus(statusCode int) bool {
	if statusCode == 0 {
		return true
	}
	if statusCode == http.StatusTooManyRequests {
		return true
	}
	return statusCode >= 500 && statusCode <= 599
}

// chunkSubRequests splits sub-requests into groups of at most size, keeping each ARM
// /batch call under the synchronous threshold.
func chunkSubRequests(subRequests []armBatchSubRequest, size int) [][]armBatchSubRequest {
	var chunks [][]armBatchSubRequest
	for i := 0; i < len(subRequests); i += size {
		end := i + size
		if end > len(subRequests) {
			end = len(subRequests)
		}
		chunks = append(chunks, subRequests[i:end])
	}
	return chunks
}

// appendFrames routes frames to their RefID's response, preserving any already collected.
func appendFrames(result *backend.QueryDataResponse, frames data.Frames) {
	for _, frame := range frames {
		dr := result.Responses[frame.RefID]
		dr.Frames = append(dr.Frames, frame)
		result.Responses[frame.RefID] = dr
	}
}

// fallbackBatch re-fetches a failed batch's resources via the ARM /batch endpoint, chunked
// to stay synchronous. If an ARM /batch chunk itself fails, the affected queries fail; we do
// not fan out to individual requests, which would be more likely to hit the same throttling
// that triggered the fallback. Results are written into result by RefID.
func (e *AzureMonitorDatasource) fallbackBatch(ctx context.Context, br batchResult, originalByRefID map[string]backend.DataQuery, dsInfo types.DatasourceInfo, client *http.Client, armURL, azurePortalURL string, result *backend.QueryDataResponse) {
	e.Logger.Debug("metrics batch failed with a retryable error; falling back to ARM /batch",
		"statusCode", br.StatusCode, "numResources", len(br.Batch.ResourceIDs))

	subRequests, queriesByName, err := e.buildFallbackSubRequests(br.Batch, originalByRefID, dsInfo)
	if err != nil {
		// Can't build the fallback requests; surface the original batch error.
		e.Logger.Warn("failed to build ARM /batch fallback requests; surfacing the original batch error", "err", err)
		for _, q := range br.Batch.Queries {
			attachErr(result, q.RefID, br.Err)
		}
		return
	}
	if len(subRequests) == 0 {
		// Nothing to retry; surface the original batch error rather than
		// returning silently with neither frames nor errors.
		e.Logger.Warn("ARM /batch fallback produced no sub-requests; surfacing the original batch error")
		for _, q := range br.Batch.Queries {
			attachErr(result, q.RefID, br.Err)
		}
		return
	}

	// Resolve the subscription display name (cached) so {{subscription}} in
	// legends renders the friendly name, matching the primary batch path.
	subscription, err := e.retrieveSubscriptionDetails(client, ctx, br.Batch.Key.Subscription,
		armURL, dsInfo.DatasourceID, dsInfo.OrgID, dsInfo.Credentials)
	if err != nil {
		for _, q := range br.Batch.Queries {
			attachErr(result, q.RefID, err)
		}
		return
	}

	for _, chunk := range chunkSubRequests(subRequests, maxARMBatchSize) {
		armResp, err := executeARMBatch(ctx, client, armURL, chunk)
		if err != nil {
			// The ARM /batch fallback itself failed; fail the affected queries.
			e.Logger.Warn("ARM /batch fallback request failed", "err", err, "numSubRequests", len(chunk))
			for _, sub := range chunk {
				for _, q := range queriesByName[sub.Name] {
					attachErr(result, q.RefID, err)
				}
			}
			continue
		}

		frames, errsByRefID := e.parseFallbackResponse(armResp, queriesByName, azurePortalURL, subscription)
		appendFrames(result, frames)
		// Errors are scoped per refID so a query whose resources all succeeded
		// is not marked failed by a sibling query's failure.
		for refID, parseErr := range errsByRefID {
			e.Logger.Warn("ARM /batch fallback returned partial failures", "refID", refID, "err", parseErr)
			attachErr(result, refID, parseErr)
		}
	}

	// Ensure every query in the batch has a response entry even when it yielded
	// no frames and no error, matching the primary batch path.
	for _, q := range br.Batch.Queries {
		if _, ok := result.Responses[q.RefID]; !ok {
			result.Responses[q.RefID] = backend.DataResponse{}
		}
	}
}
