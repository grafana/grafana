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
	"github.com/grafana/grafana-plugin-sdk-go/data"
	jsoniter "github.com/json-iterator/go"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/util/converter"
)

func (promQLQ *cloudMonitoringProm) run(ctx context.Context, req *backend.QueryDataRequest,
	s *Service, dsInfo datasourceInfo, tracer tracing.Tracer) (*backend.DataResponse, any, string, error) {
	dr := &backend.DataResponse{}
	projectName, err := s.ensureProject(ctx, dsInfo, promQLQ.parameters.ProjectName)
	if err != nil {
		dr.Error = err
		return dr, promResponse{}, "", nil
	}
	r, err := createRequest(ctx, promQLQ.logger, &dsInfo, path.Join("/v1/projects", projectName, "location/global/prometheus/api/v1/query_range"), nil)
	if err != nil {
		dr.Error = err
		return dr, promResponse{}, "", nil
	}

	span := traceReq(ctx, tracer, req, dsInfo, r, "")
	defer span.End()

	requestBody := map[string]interface{}{
		"query": promQLQ.parameters.Expr,
		"end":   formatTime(promQLQ.timeRange.To),
		"start": formatTime(promQLQ.timeRange.From),
		"step":  promQLQ.parameters.Step,
	}

	res, err := doRequestProm(r, dsInfo, requestBody)
	if err != nil {
		dr.Error = err
		return dr, promResponse{}, "", nil
	}

	return dr, res, r.URL.RawQuery, nil
}

func doRequestProm(r *http.Request, dsInfo datasourceInfo, body map[string]interface{}) (*http.Response, error) {
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
		return res, err
	}

	return res, nil
}

func (promQLQ *cloudMonitoringProm) parseResponse(queryRes *backend.DataResponse,
	response any, executedQueryString string) error {
	res := response.(*http.Response)
	defer func() {
		if err := res.Body.Close(); err != nil {
			promQLQ.logger.Error("Failed to close response body", "err", err)
		}
	}()
	iter := jsoniter.Parse(jsoniter.ConfigDefault, res.Body, 1024)
	r := converter.ReadPrometheusStyleResult(iter, converter.Options{
		MatrixWideSeries: false,
		VectorWideSeries: false,
		Dataplane:        false,
	})

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
