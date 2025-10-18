package graphite

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/errorsource"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"golang.org/x/net/html"
)

func (s *Service) RunQuery(ctx context.Context, req *backend.QueryDataRequest, dsInfo *datasourceInfo) (*backend.QueryDataResponse, error) {
	emptyQueries := []string{}
	graphiteQueries := map[string]struct {
		req      *http.Request
		formData url.Values
	}{}
	result := backend.NewQueryDataResponse()

	for _, query := range req.Queries {
		graphiteReq, formData, emptyQuery, err := s.createGraphiteRequest(ctx, query, dsInfo)
		if err != nil {
			result.Responses[query.RefID] = backend.ErrorResponseWithErrorSource(err)
			return result, nil
		}

		if emptyQuery != nil {
			emptyQueries = append(emptyQueries, fmt.Sprintf("Query: %v has no target", emptyQuery))
			continue
		}

		graphiteQueries[query.RefID] = struct {
			req      *http.Request
			formData url.Values
		}{
			req:      graphiteReq,
			formData: formData,
		}
	}

	if len(emptyQueries) != 0 {
		s.logger.Warn("Found query models without targets", "models without targets", strings.Join(emptyQueries, "\n"))
		// If no queries had a valid target, return an error; otherwise, attempt with the targets we have
		if len(emptyQueries) == len(req.Queries) {
			if result.Responses == nil {
				result.Responses = make(map[string]backend.DataResponse)
			}
			// marking this downstream error as it is a user error, but arguably this is a plugin error
			// since the plugin should have frontend validation that prevents us from getting into this state
			missingQueryResponse := backend.ErrDataResponseWithSource(400, backend.ErrorSourceDownstream, "no query target found")
			result.Responses["A"] = missingQueryResponse
			return result, nil
		}
	}

	frames := data.Frames{}

	for refId, graphiteReq := range graphiteQueries {
		_, span := tracing.DefaultTracer().Start(ctx, "graphite query")
		defer span.End()
		targetStr := strings.Join(graphiteReq.formData["target"], ",")
		span.SetAttributes(
			attribute.String("refId", refId),
			attribute.String("target", targetStr),
			attribute.String("from", graphiteReq.formData["from"][0]),
			attribute.String("until", graphiteReq.formData["until"][0]),
			attribute.Int64("datasource_id", dsInfo.Id),
			attribute.Int64("org_id", req.PluginContext.OrgID),
		)
		res, err := dsInfo.HTTPClient.Do(graphiteReq.req)
		if res != nil {
			span.SetAttributes(attribute.Int("graphite.response.code", res.StatusCode))
		}
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			result.Responses[refId] = backend.ErrorResponseWithErrorSource(backend.DownstreamError(err))
			return result, nil
		}

		defer func() {
			err := res.Body.Close()
			if err != nil {
				s.logger.Warn("Failed to close response body", "error", err)
			}
		}()

		queryFrames, err := s.toDataFrames(res, refId)
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			result.Responses[refId] = backend.ErrorResponseWithErrorSource(err)
			return result, nil
		}

		frames = append(frames, queryFrames...)
	}

	for _, f := range frames {
		if resp, ok := result.Responses[f.Name]; ok {
			resp.Frames = append(resp.Frames, f)
			result.Responses[f.Name] = resp
		} else {
			result.Responses[f.Name] = backend.DataResponse{
				Frames: data.Frames{f},
			}
		}
	}

	return result, nil
}

// processQuery converts a Graphite data source query to a Graphite query target. It returns the target,
// and the model if the target is invalid
func (s *Service) processQuery(query backend.DataQuery) (string, *GraphiteQuery, bool, error) {
	queryJSON := GraphiteQuery{}
	err := json.Unmarshal(query.JSON, &queryJSON)
	if err != nil {
		return "", &queryJSON, false, backend.PluginError(fmt.Errorf("failed to decode the Graphite query: %w", err))
	}
	s.logger.Debug("Graphite", "query", queryJSON)
	currTarget := queryJSON.TargetFull

	if currTarget == "" {
		currTarget = queryJSON.Target
	}
	if currTarget == "" {
		s.logger.Debug("Graphite", "empty query target", queryJSON)
		return "", &queryJSON, false, nil
	}
	target := fixIntervalFormat(currTarget)

	return target, nil, queryJSON.IsMetricTank, nil
}

func (s *Service) createGraphiteRequest(ctx context.Context, query backend.DataQuery, dsInfo *datasourceInfo) (*http.Request, url.Values, *GraphiteQuery, error) {
	/*
		graphite doc about from and until, with sdk we are getting absolute instead of relative time
		https://graphite-api.readthedocs.io/en/latest/api.html#from-until
	*/
	from, until := epochMStoGraphiteTime(query.TimeRange)
	formData := url.Values{
		"from":          []string{from},
		"until":         []string{until},
		"format":        []string{"json"},
		"maxDataPoints": []string{fmt.Sprintf("%d", query.MaxDataPoints)},
		"target":        []string{},
	}

	target, emptyQuery, isMetricTank, err := s.processQuery(query)
	if err != nil {
		return nil, formData, nil, err
	}

	if emptyQuery != nil {
		s.logger.Debug("Graphite", "empty query target", emptyQuery)
		return nil, formData, emptyQuery, nil
	}

	formData["target"] = []string{target}

	s.logger.Debug("Graphite request", "params", formData)

	params := map[string][]string{}
	if isMetricTank {
		params["meta"] = []string{"true"}
	}

	graphiteReq, err := s.createRequest(ctx, dsInfo, URLParams{
		SubPath:     "render",
		Method:      http.MethodPost,
		Body:        strings.NewReader(formData.Encode()),
		Headers:     map[string]string{"Content-Type": "application/x-www-form-urlencoded"},
		QueryParams: params,
	})
	if err != nil {
		return nil, formData, nil, err
	}

	return graphiteReq, formData, emptyQuery, nil
}

func (s *Service) toDataFrames(response *http.Response, refId string) (frames data.Frames, error error) {
	responseData, err := s.parseResponse(response)
	if err != nil {
		return nil, err
	}

	frames = data.Frames{}
	for _, series := range responseData {
		timeVector := make([]time.Time, 0, len(series.DataPoints))
		values := make([]*float64, 0, len(series.DataPoints))

		for _, dataPoint := range series.DataPoints {
			var timestamp, value, err = parseDataTimePoint(dataPoint)
			if err != nil {
				return nil, err
			}
			timeVector = append(timeVector, timestamp)
			values = append(values, value)
		}

		tags := make(map[string]string)
		for name, value := range series.Tags {
			if name == "name" {
				value = series.Target
			}
			switch value := value.(type) {
			case string:
				tags[name] = value
			case float64:
				tags[name] = strconv.FormatFloat(value, 'f', -1, 64)
			}
		}

		frames = append(frames, data.NewFrame(refId,
			data.NewField("time", nil, timeVector),
			data.NewField("value", tags, values).SetConfig(&data.FieldConfig{DisplayNameFromDS: series.Target})).SetMeta(
			&data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti}))

		s.logger.Debug("Graphite response", "target", series.Target, "datapoints", len(series.DataPoints))
	}
	return frames, nil
}

func (s *Service) parseResponse(res *http.Response) ([]TargetResponseDTO, error) {
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, backend.DownstreamError(err)
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			s.logger.Warn("Failed to close response body", "err", err)
		}
	}()

	if res.StatusCode/100 != 2 {
		graphiteError := parseGraphiteError(res.StatusCode, string(body))
		s.logger.Info("Request failed", "status", res.Status, "error", graphiteError, "body", string(body))
		return nil, errorsource.SourceError(backend.ErrorSourceFromHTTPStatus(res.StatusCode), fmt.Errorf("request failed with error: %s", graphiteError), false)
	}

	var data []TargetResponseDTO
	err = json.Unmarshal(body, &data)
	if err != nil {
		s.logger.Info("Failed to unmarshal graphite response", "error", err, "status", res.Status, "body", string(body))
		return nil, backend.DownstreamError(err)
	}

	return data, nil
}

/**
 * Duplicated from the frontend.
 * Graphite-web before v1.6 returns HTTP 500 with full stack traces in an HTML page
 * when a query fails. It results in massive error alerts with HTML tags in the UI.
 * This function removes all HTML tags and keeps only the last line from the stack
 * trace which should be the most meaningful.
 */
func parseGraphiteError(status int, body string) (errorMsg string) {
	errorMsg = body
	if status == http.StatusInternalServerError {
		if strings.HasPrefix(body, "<body") {
			htmlErrorMsg := ""
			tokenizer := html.NewTokenizer(strings.NewReader(body))
			// Break here as that typically means we've reached EOF
			for tokenizer.Next() != html.ErrorToken {
				token := tokenizer.Token()
				if token.Type == html.TextToken {
					trimmed := strings.TrimSpace(token.Data)
					if trimmed != "" {
						htmlErrorMsg += html.UnescapeString(trimmed) + "\n"
					}
				}
			}
			errorMsg = strings.TrimSpace(htmlErrorMsg)
		}
	}
	return errorMsg
}

func fixIntervalFormat(target string) string {
	rMinute := regexp.MustCompile(`'(\d+)m'`)
	target = rMinute.ReplaceAllStringFunc(target, func(m string) string {
		return strings.ReplaceAll(m, "m", "min")
	})
	rMonth := regexp.MustCompile(`'(\d+)M'`)
	target = rMonth.ReplaceAllStringFunc(target, func(M string) string {
		return strings.ReplaceAll(M, "M", "mon")
	})
	return target
}

func epochMStoGraphiteTime(tr backend.TimeRange) (string, string) {
	return fmt.Sprintf("%d", tr.From.UTC().Unix()), fmt.Sprintf("%d", tr.To.UTC().Unix())
}

/**
 * Graphite should always return timestamp as a number but values might be nil when data is missing
 */
func parseDataTimePoint(dataTimePoint DataTimePoint) (time.Time, *float64, error) {
	if !dataTimePoint[1].Valid {
		return time.Time{}, nil, errors.New("failed to parse data point timestamp")
	}

	timestamp := time.Unix(int64(dataTimePoint[1].Float64), 0).UTC()

	if dataTimePoint[0].Valid {
		var value = new(float64)
		*value = dataTimePoint[0].Float64
		return timestamp, value, nil
	} else {
		return timestamp, nil, nil
	}
}
