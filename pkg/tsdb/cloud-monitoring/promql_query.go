package cloudmonitoring

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"path"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb/cloud-monitoring/converter"
	jsoniter "github.com/json-iterator/go"
)

func (promQLQ *cloudMonitoringProm) run(ctx context.Context, req *backend.QueryDataRequest,
	s *Service, dsInfo datasourceInfo, logger log.Logger) (*backend.DataResponse, any, string, error) {
	dr := &backend.DataResponse{}
	projectName, err := s.ensureProject(ctx, dsInfo, promQLQ.parameters.ProjectName)
	if err != nil {
		dr.Error = err
		return dr, backend.DataResponse{}, "", nil
	}
	r, err := createRequest(ctx, &dsInfo, path.Join("/v1/projects", projectName, "location/global/prometheus/api/v1/query_range"), nil)
	if err != nil {
		dr.Error = err
		return dr, backend.DataResponse{}, "", nil
	}

	span := traceReq(ctx, req, dsInfo, r, "", promQLQ.timeRange)
	defer span.End()

	requestBody := map[string]any{
		"query": promQLQ.parameters.Expr,
		"end":   formatTime(promQLQ.timeRange.To),
		"start": formatTime(promQLQ.timeRange.From),
		"step":  promQLQ.parameters.Step,
	}

	res, err := doRequestProm(r, dsInfo, requestBody)
	if err != nil {
		dr.Error = err
		return dr, backend.DataResponse{}, "", nil
	}

	defer func() {
		if err := res.Body.Close(); err != nil {
			s.logger.Error("Failed to close response body", "err", err, "statusSource", backend.ErrorSourceDownstream)
		}
	}()

	return dr, parseProm(res), r.URL.RawQuery, nil
}

func doRequestProm(r *http.Request, dsInfo datasourceInfo, body map[string]any) (*http.Response, error) {
	if body != nil {
		buf, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		r.Body = io.NopCloser(bytes.NewBuffer(buf))
		r.Method = http.MethodPost
	}
	res, err := dsInfo.services[cloudMonitor].client.Do(r)
	if err != nil {
		return res, backend.DownstreamError(err)
	}

	return res, nil
}

func parseProm(res *http.Response) backend.DataResponse {
	iter := jsoniter.Parse(jsoniter.ConfigDefault, res.Body, 1024)
	return converter.ReadPrometheusStyleResult(iter, converter.Options{
		Dataplane: false,
	})
}

// We are not parsing the response in this function. ReadPrometheusStyleResult needs an open reader and we cannot
// pass an open reader to this function because lint complains as it is unsafe
func (promQLQ *cloudMonitoringProm) parseResponse(queryRes *backend.DataResponse,
	response any, executedQueryString string, logger log.Logger) error {
	r := response.(backend.DataResponse)
	// Add frame to attach metadata
	if len(r.Frames) == 0 {
		r.Frames = append(r.Frames, data.NewFrame(""))
	}

	*queryRes = r
	return nil
}

func (promQLQ *cloudMonitoringProm) buildDeepLink() string {
	return ""
}

func (promQLQ *cloudMonitoringProm) getRefID() string {
	return promQLQ.refID
}

func (promQLQ *cloudMonitoringProm) getAliasBy() string {
	return promQLQ.aliasBy
}

func (promQLQ *cloudMonitoringProm) getParameter(i string) string {
	return ""
}

func formatTime(t time.Time) string {
	return strconv.FormatFloat(float64(t.Unix())+float64(t.Nanosecond())/1e9, 'f', -1, 64)
}
