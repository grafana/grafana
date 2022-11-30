package cloudmonitoring

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
	"go.opentelemetry.io/otel/attribute"
)

func addInterval(period string, field *data.Field) error {
	period = strings.TrimPrefix(period, "+")
	p, err := intervalv2.ParseIntervalStringToTimeDuration(period)
	if err != nil {
		return err
	}
	if err == nil {
		if field.Config != nil {
			field.Config.Interval = float64(p.Milliseconds())
		} else {
			field.SetConfig(&data.FieldConfig{
				Interval: float64(p.Milliseconds()),
			})
		}
	}
	return nil
}

func toString(v interface{}) string {
	if v == nil {
		return ""
	}
	return v.(string)
}

func createRequest(ctx context.Context, logger log.Logger, dsInfo *datasourceInfo, proxyPass string, body io.Reader) (*http.Request, error) {
	u, err := url.Parse(dsInfo.url)
	if err != nil {
		return nil, err
	}
	u.Path = path.Join(u.Path, "render")

	method := http.MethodGet
	if body != nil {
		method = http.MethodPost
	}
	req, err := http.NewRequestWithContext(ctx, method, dsInfo.services[cloudMonitor].url, body)
	if err != nil {
		logger.Error("Failed to create request", "error", err)
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.URL.Path = proxyPass

	return req, nil
}

func doRequestPage(ctx context.Context, logger log.Logger, r *http.Request, dsInfo datasourceInfo, params url.Values, body map[string]interface{}) (cloudMonitoringResponse, error) {
	if params != nil {
		r.URL.RawQuery = params.Encode()
	}
	if body != nil {
		buf, err := json.Marshal(body)
		if err != nil {
			return cloudMonitoringResponse{}, err
		}
		r.Body = io.NopCloser(bytes.NewBuffer(buf))
		r.Method = http.MethodPost
	}
	res, err := dsInfo.services[cloudMonitor].client.Do(r)
	if err != nil {
		return cloudMonitoringResponse{}, err
	}

	dnext, err := unmarshalResponse(logger, res)
	if err != nil {
		return cloudMonitoringResponse{}, err
	}

	return dnext, nil
}

func doRequestWithPagination(ctx context.Context, logger log.Logger, r *http.Request, dsInfo datasourceInfo, params url.Values, body map[string]interface{}) (cloudMonitoringResponse, error) {
	d, err := doRequestPage(ctx, logger, r, dsInfo, params, body)
	if err != nil {
		return cloudMonitoringResponse{}, err
	}
	for d.NextPageToken != "" {
		if params != nil {
			params["pageToken"] = []string{d.NextPageToken}
		}
		if body != nil {
			body["pageToken"] = d.NextPageToken
		}
		nextPage, err := doRequestPage(ctx, logger, r, dsInfo, params, body)
		if err != nil {
			return cloudMonitoringResponse{}, err
		}
		d.TimeSeries = append(d.TimeSeries, nextPage.TimeSeries...)
		d.TimeSeriesData = append(d.TimeSeriesData, nextPage.TimeSeriesData...)
		d.NextPageToken = nextPage.NextPageToken
	}
	return d, nil
}

func traceReq(ctx context.Context, tracer tracing.Tracer, req *backend.QueryDataRequest, dsInfo datasourceInfo, r *http.Request, target string) tracing.Span {
	ctx, span := tracer.Start(ctx, "cloudMonitoring query")
	span.SetAttributes("target", target, attribute.Key("target").String(target))
	span.SetAttributes("from", req.Queries[0].TimeRange.From, attribute.Key("from").String(req.Queries[0].TimeRange.From.String()))
	span.SetAttributes("until", req.Queries[0].TimeRange.To, attribute.Key("until").String(req.Queries[0].TimeRange.To.String()))
	span.SetAttributes("datasource_id", dsInfo.id, attribute.Key("datasource_id").Int64(dsInfo.id))
	span.SetAttributes("org_id", req.PluginContext.OrgID, attribute.Key("org_id").Int64(req.PluginContext.OrgID))
	tracer.Inject(ctx, r.Header, span)
	return span
}

func runTimeSeriesRequest(ctx context.Context, logger log.Logger, req *backend.QueryDataRequest,
	s *Service, dsInfo datasourceInfo, tracer tracing.Tracer, projectName string, params url.Values, body map[string]interface{}) (*backend.DataResponse, cloudMonitoringResponse, string, error) {
	dr := &backend.DataResponse{}
	projectName, err := s.ensureProject(ctx, dsInfo, projectName)
	if err != nil {
		dr.Error = err
		return dr, cloudMonitoringResponse{}, "", nil
	}
	timeSeriesMethod := "timeSeries"
	if body != nil {
		timeSeriesMethod += ":query"
	}
	r, err := createRequest(ctx, logger, &dsInfo, path.Join("/v3/projects", projectName, timeSeriesMethod), nil)
	if err != nil {
		dr.Error = err
		return dr, cloudMonitoringResponse{}, "", nil
	}

	span := traceReq(ctx, tracer, req, dsInfo, r, params.Encode())
	defer span.End()

	d, err := doRequestWithPagination(ctx, logger, r, dsInfo, params, body)
	if err != nil {
		dr.Error = err
		return dr, cloudMonitoringResponse{}, "", nil
	}

	return dr, d, r.URL.RawQuery, nil
}
