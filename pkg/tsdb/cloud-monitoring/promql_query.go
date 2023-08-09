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
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	jsoniter "github.com/json-iterator/go"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/tsdb/cloud-monitoring/kinds/dataquery"
	"github.com/grafana/grafana/pkg/util/converter"
)

func (s *Service) executePromQuery(ctx context.Context, req *backend.QueryDataRequest, dsInfo datasourceInfo, queries []cloudMonitoringQueryExecutor) (
	*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()
	for _, queryExecutor := range queries {
		queryRes, dr, executedQueryString, err := queryExecutor.run(ctx, req, s, dsInfo, s.tracer)
		logger := slog.FromContext(ctx)
		logger.Error("doRequest", "dr", dr.(*http.Response), "err", err)
		if err != nil {
			return resp, err
		}
		//logger.Error("BELLOOOO", "queryRes", queryRes, "dr", dr, "executedQueryString", executedQueryString, "err", err)
		err = queryExecutor.parseResponse(queryRes, dr, executedQueryString)
		if err != nil {
			queryRes.Error = err
		}

		resp.Responses[queryExecutor.getRefID()] = *queryRes
	}

	return resp, nil
}
func (promQLQ *cloudMonitoringPromQL) run(ctx context.Context, req *backend.QueryDataRequest,
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

	promQLQ.logger.Error("dafsd", "promQLQ.timeRange.To", promQLQ.timeRange.To, "promQLQ.timeRange.From", promQLQ.timeRange.From)
	promQLQ.parameters.Step = 10 //do not keep
	requestBody := map[string]interface{}{
		"query": promQLQ.parameters.Query,
		"end":   formatTime(promQLQ.timeRange.To),
		"start": formatTime(promQLQ.timeRange.From),
		"step":  fmt.Sprintf("%vs", promQLQ.parameters.Step),
	}

	d, err := doRequestProm(ctx, promQLQ.logger, r, dsInfo, nil, requestBody)
	if err != nil {
		dr.Error = err
		return dr, promResponse{}, "", nil
	}

	return dr, d, r.URL.RawQuery, nil
}

func doRequestProm(ctx context.Context, logger log.Logger, r *http.Request, dsInfo datasourceInfo, params url.Values, body map[string]interface{}) (*http.Response, error) {
	if params != nil {
		r.URL.RawQuery = params.Encode()
	}
	if body != nil {
		buf, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		r.Body = io.NopCloser(bytes.NewBuffer(buf))
		r.Method = http.MethodPost
	}
	res, err := dsInfo.services[cloudMonitor].client.Do(r)
	logger.Error("doRequest", "res", res, "err", err, "r", r, "body", body)
	if err != nil {
		return res, err
	}

	// defer func() {
	// 	if err = res.Body.Close(); err != nil {
	// 		logger.Warn("failed to close response body", "error", err)
	// 	}
	// }()

	//resp, err := unmarshalPromResponse(logger, res)
	//logger.Error("unmarshal", "dnext", dnext, "err", err)
	// if err != nil {
	// 	return resp, err
	// }

	return res, nil
}

func (promQLQ *cloudMonitoringPromQL) parseResponse(queryRes *backend.DataResponse,
	response any, executedQueryString string) error {
	resp := response.(*http.Response)
	qr := promQLQ.parseResponseK(promQLQ.parameters, resp)
	*queryRes = *qr
	promQLQ.logger.Error("parseResponse", "queryRes", resp)
	return nil
}

func (promQLQ *cloudMonitoringPromQL) parseResponseK(query *dataquery.PromQLQuery, res *http.Response) *backend.DataResponse {
	defer func() {
		_ = res.Body.Close()
		//if err := res.Body.Close(); err != nil {
		//s.log.FromContext(ctx).Error("Failed to close response body", "err", err)
		//}
	}()
	// body, err := io.ReadAll(res.Body)
	// promQLQ.logger.Error("body", "body", string(body), "r", err)
	iter := jsoniter.Parse(jsoniter.ConfigDefault, res.Body, 1024)
	promQLQ.logger.Error("iter", "itr", res.Body)
	r := converter.ReadPrometheusStyleResult(iter, converter.Options{
		MatrixWideSeries: false,
		VectorWideSeries: false,
		Dataplane:        false,
	})
	promQLQ.logger.Error("parseResponse", "queryRes", r, "len", len(r.Frames))

	// Add frame to attach metadata
	if len(r.Frames) == 0 {
		r.Frames = append(r.Frames, data.NewFrame(""))
	}

	// The ExecutedQueryString can be viewed in QueryInspector in UI
	for _, frame := range r.Frames {
		addMetadataToMultiFrame(query, frame, false)

	}

	return &r
}

func addMetadataToMultiFrame(query *dataquery.PromQLQuery, frame *data.Frame, enableDataplane bool) {
	if frame.Meta == nil {
		frame.Meta = &data.FrameMeta{}
	}
	frame.Meta.ExecutedQueryString = executedQueryString(query)
	if len(frame.Fields) < 2 {
		return
	}
	step := time.Second * time.Duration(query.Step)
	frame.Fields[0].Config = &data.FieldConfig{Interval: float64(step.Milliseconds())}

	customName := "" //getName(q, frame.Fields[1])
	if customName != "" {
		frame.Fields[1].Config = &data.FieldConfig{DisplayNameFromDS: customName}
	}

	if enableDataplane {
		valueField := frame.Fields[1]
		if n, ok := valueField.Labels["__name__"]; ok {
			valueField.Name = n
		}
	} else {
		frame.Name = customName
	}
}

func executedQueryString(q *dataquery.PromQLQuery) string {
	step := time.Second * time.Duration(q.Step)
	return "Expr: " + q.Query + "\n" + "Step: " + step.String()
}

func (promQLQ *cloudMonitoringPromQL) buildDeepLink() string {
	dataSets := []map[string]interface{}{
		{
			"timeSeriesQuery": promQLQ.parameters.Query,
			"targetAxis":      "Y1",
			"plotType":        "LINE",
		},
	}

	link, err := generateLink(
		promQLQ.parameters.ProjectName,
		dataSets,
		promQLQ.timeRange.From.Format(time.RFC3339Nano),
		promQLQ.timeRange.To.Format(time.RFC3339Nano),
	)
	if err != nil {
		slog.Error(
			"Failed to generate deep link: unable to parse metrics explorer URL",
			"ProjectName", promQLQ.parameters.Query,
			"error", err,
		)
	}

	return link
}
func (promQLQ *cloudMonitoringPromQL) getRefID() string {
	return promQLQ.refID
}

func (promQLQ *cloudMonitoringPromQL) getAliasBy() string {
	return promQLQ.aliasBy
}

func (promQLQ *cloudMonitoringPromQL) getParameter(i string) string {
	switch i {
	case "project":
		return promQLQ.parameters.ProjectName
	default:
		return ""
	}
}

func unmarshalPromResponse(logger log.Logger, res *http.Response) (promResponse, error) {
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return promResponse{}, err
	}

	defer func() {
		if err := res.Body.Close(); err != nil {
			logger.Warn("Failed to close response body", "err", err)
		}
	}()

	if res.StatusCode/100 != 2 {
		logger.Error("Request failed", "status", res.Status, "body", string(body))
		return promResponse{}, fmt.Errorf("query failed: %s", string(body))
	}

	var data promResponse
	err = json.Unmarshal(body, &data)
	if err != nil {
		logger.Error("Failed to unmarshal Prometheus response", "error", err, "status", res.Status, "body", string(body))
		return promResponse{}, fmt.Errorf("failed to unmarshal query response: %w", err)
	}

	return data, nil
}

func formatTime(t time.Time) string {
	return strconv.FormatFloat(float64(t.Unix())+float64(t.Nanosecond())/1e9, 'f', -1, 64)
}
