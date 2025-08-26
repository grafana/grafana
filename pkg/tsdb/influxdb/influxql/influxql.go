package influxql

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strings"
	"sync"

	"github.com/grafana/dskit/concurrency"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/influxql/buffered"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/influxql/querydata"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
)

const (
	defaultRetentionPolicy = "default"
	metadataPrefix         = "x-grafana-meta-add-"
)

var (
	ErrInvalidHttpMode = errors.New("'httpMode' should be either 'GET' or 'POST'")
	ErrInvalidUrl      = errors.New("URL must contain scheme and host")
	glog               = log.New("tsdb.influx_influxql")
)

func Query(ctx context.Context, tracer trace.Tracer, dsInfo *models.DatasourceInfo, req *backend.QueryDataRequest, features featuremgmt.FeatureToggles) (*backend.QueryDataResponse, error) {
	logger := glog.FromContext(ctx)
	response := backend.NewQueryDataResponse()
	var err error

	// We are testing running of queries in parallel behind feature flag
	if features.IsEnabled(ctx, featuremgmt.FlagInfluxdbRunQueriesInParallel) {
		concurrentQueryCount, err := req.PluginContext.GrafanaConfig.ConcurrentQueryCount()
		if err != nil {
			logger.Debug(fmt.Sprintf("Concurrent Query Count read/parse error: %v", err), featuremgmt.FlagInfluxdbRunQueriesInParallel)
			concurrentQueryCount = 10
		}

		responseLock := sync.Mutex{}
		err = concurrency.ForEachJob(ctx, len(req.Queries), concurrentQueryCount, func(ctx context.Context, idx int) error {
			reqQuery := req.Queries[idx]
			query, err := models.QueryParse(reqQuery, logger)
			if err != nil {
				responseLock.Lock()
				response.Responses[query.RefID] = backend.DataResponse{
					Error:       err,
					ErrorSource: backend.ErrorSourceDownstream,
				}
				responseLock.Unlock()
				return nil
			}

			// query.Build() unconditionally returns nil for error.
			rawQuery, _ := query.Build(req)

			query.RefID = reqQuery.RefID
			query.RawQuery = rawQuery

			if setting.Env == setting.Dev {
				logger.Debug("Influxdb query", "raw query", rawQuery)
			}

			request, err := createRequest(ctx, logger, dsInfo, rawQuery, query.Policy)
			if err != nil {
				responseLock.Lock()
				response.Responses[query.RefID] = backend.DataResponse{
					Error:       err,
					ErrorSource: backend.ErrorSourceDownstream,
				}
				responseLock.Unlock()
				return nil
			}

			resp, err := execute(ctx, tracer, dsInfo, logger, query, request, features.IsEnabled(ctx, featuremgmt.FlagInfluxqlStreamingParser))

			responseLock.Lock()
			defer responseLock.Unlock()
			if err != nil {
				response.Responses[query.RefID] = backend.DataResponse{Error: err}
			} else {
				response.Responses[query.RefID] = resp
			}
			return nil // errors are saved per-query,always return nil
		})

		if err != nil {
			logger.Debug("Influxdb concurrent query error", "concurrent query", err)
		}
	} else {
		for _, reqQuery := range req.Queries {
			query, err := models.QueryParse(reqQuery, logger)
			if err != nil {
				response.Responses[query.RefID] = backend.DataResponse{
					Error:       err,
					ErrorSource: backend.ErrorSourceDownstream,
				}
				continue
			}

			// query.Build() unconditionally returns nil for error.
			rawQuery, _ := query.Build(req)

			query.RefID = reqQuery.RefID
			query.RawQuery = rawQuery

			if setting.Env == setting.Dev {
				logger.Debug("Influxdb query", "raw query", rawQuery)
			}

			request, err := createRequest(ctx, logger, dsInfo, rawQuery, query.Policy)
			if err != nil {
				response.Responses[query.RefID] = backend.DataResponse{
					Error:       err,
					ErrorSource: backend.ErrorSourceDownstream,
				}
				continue
			}

			resp, err := execute(ctx, tracer, dsInfo, logger, query, request, features.IsEnabled(ctx, featuremgmt.FlagInfluxqlStreamingParser))

			if err != nil {
				response.Responses[query.RefID] = backend.DataResponse{Error: err}
			} else {
				response.Responses[query.RefID] = resp
			}
		}
	}

	return response, err
}

func createRequest(ctx context.Context, logger log.Logger, dsInfo *models.DatasourceInfo, queryStr string, retentionPolicy string) (*http.Request, error) {
	u, err := url.Parse(dsInfo.URL)
	if err != nil {
		return nil, err
	}

	// It's possible that the configuration is bad, and we'll have a URL
	// without a scheme or host. This is valid from the PoV of the Go std
	// library url.Parse(), but not for this data source.
	if u.Host == "" || u.Scheme == "" {
		return nil, ErrInvalidUrl
	}

	u.Path = path.Join(u.Path, "query")
	httpMode := dsInfo.HTTPMode

	var req *http.Request
	switch httpMode {
	case "GET":
		req, err = http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
		if err != nil {
			return nil, err
		}
	case "POST":
		bodyValues := url.Values{}
		bodyValues.Add("q", queryStr)
		body := bodyValues.Encode()
		req, err = http.NewRequestWithContext(ctx, http.MethodPost, u.String(), strings.NewReader(body))
		if err != nil {
			return nil, err
		}
	default:
		return nil, ErrInvalidHttpMode
	}

	params := req.URL.Query()
	params.Set("db", dsInfo.DbName)
	params.Set("epoch", "ms")
	// default is hardcoded default retention policy
	// InfluxDB will use the default policy when it is not added to the request
	if retentionPolicy != "" && retentionPolicy != "default" {
		params.Set("rp", retentionPolicy)
	}

	switch httpMode {
	case "GET":
		params.Set("q", queryStr)
	case "POST":
		req.Header.Set("Content-type", "application/x-www-form-urlencoded")
	}

	req.URL.RawQuery = params.Encode()

	logger.Debug("Influxdb request", "url", req.URL.String())
	return req, nil
}

func execute(ctx context.Context, tracer trace.Tracer, dsInfo *models.DatasourceInfo, logger log.Logger, query *models.Query, request *http.Request, isStreamingParserEnabled bool) (backend.DataResponse, error) {
	res, err := dsInfo.HTTPClient.Do(request)
	if err != nil {
		return backend.DataResponse{
			Error: err,
		}, err
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			logger.Warn("Failed to close response body", "err", err)
		}
	}()

	_, endSpan := startTrace(ctx, tracer, "datasource.influxdb.influxql.parseResponse")
	defer endSpan()

	var resp *backend.DataResponse
	if isStreamingParserEnabled {
		logger.Info("InfluxDB InfluxQL streaming parser enabled: ", "info")
		resp = querydata.ResponseParse(res.Body, res.StatusCode, query)
	} else {
		resp = buffered.ResponseParse(res.Body, res.StatusCode, query)
	}

	if len(resp.Frames) > 0 {
		resp.Frames[0].Meta.Custom = readCustomMetadata(res)
	}

	return *resp, nil
}

func readCustomMetadata(res *http.Response) map[string]any {
	var result map[string]any
	for k := range res.Header {
		if key, found := strings.CutPrefix(strings.ToLower(k), metadataPrefix); found {
			if result == nil {
				result = make(map[string]any)
			}
			result[key] = res.Header.Get(k)
		}
	}
	return result
}

// startTrace setups a trace but does not panic if tracer is nil which helps with testing
func startTrace(ctx context.Context, tracer trace.Tracer, name string, attributes ...attribute.KeyValue) (context.Context, func()) {
	if tracer == nil {
		return ctx, func() {}
	}
	ctx, span := tracer.Start(ctx, name, trace.WithAttributes(attributes...))
	return ctx, func() {
		span.End()
	}
}
