package cloudmonitoring

import (
	"context"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type annotationEvent struct {
	Title string
	Time  time.Time
	Tags  string
	Text  string
}

func (s *Service) executeAnnotationQuery(ctx context.Context, req *backend.QueryDataRequest, dsInfo datasourceInfo, queries []cloudMonitoringQueryExecutor) (
	*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()
	queryRes, dr, _, err := queries[0].run(ctx, req, s, dsInfo, s.tracer)
	if err != nil {
		return resp, err
	}

	mq := struct {
		MetricQuery struct {
			Title string `json:"title"`
			Text  string `json:"text"`
		} `json:"metricQuery"`
	}{}

	firstQuery := req.Queries[0]
	err = json.Unmarshal(firstQuery.JSON, &mq)
	if err != nil {
		return resp, nil
	}
	err = parseToAnnotations(req.Queries[0].RefID, queryRes, dr, mq.MetricQuery.Title, mq.MetricQuery.Text)
	resp.Responses[firstQuery.RefID] = *queryRes

	return resp, err
}

func parseToAnnotations(refID string, dr *backend.DataResponse,
	response cloudMonitoringResponse, title, text string) error {
	frame := data.NewFrame(refID,
		data.NewField("time", nil, []time.Time{}),
		data.NewField("title", nil, []string{}),
		data.NewField("tags", nil, []string{}),
		data.NewField("text", nil, []string{}),
	)

	for _, series := range response.TimeSeries {
		if len(series.Points) == 0 {
			continue
		}

		for i := len(series.Points) - 1; i >= 0; i-- {
			point := series.Points[i]
			value := strconv.FormatFloat(point.Value.DoubleValue, 'f', 6, 64)
			if series.ValueType == "STRING" {
				value = point.Value.StringValue
			}
			annotation := &annotationEvent{
				Time: point.Interval.EndTime,
				Title: formatAnnotationText(title, value, series.Metric.Type,
					series.Metric.Labels, series.Resource.Labels),
				Tags: "",
				Text: formatAnnotationText(text, value, series.Metric.Type,
					series.Metric.Labels, series.Resource.Labels),
			}
			frame.AppendRow(annotation.Time, annotation.Title, annotation.Tags, annotation.Text)
		}
	}
	dr.Frames = append(dr.Frames, frame)

	return nil
}

func formatAnnotationText(annotationText string, pointValue string, metricType string, metricLabels map[string]string, resourceLabels map[string]string) string {
	result := legendKeyFormat.ReplaceAllFunc([]byte(annotationText), func(in []byte) []byte {
		metaPartName := strings.Replace(string(in), "{{", "", 1)
		metaPartName = strings.Replace(metaPartName, "}}", "", 1)
		metaPartName = strings.TrimSpace(metaPartName)

		if metaPartName == "metric.type" {
			return []byte(metricType)
		}

		metricPart := replaceWithMetricPart(metaPartName, metricType)

		if metricPart != nil {
			return metricPart
		}

		if metaPartName == "metric.value" {
			return []byte(pointValue)
		}

		metaPartName = strings.Replace(metaPartName, "metric.label.", "", 1)

		if val, exists := metricLabels[metaPartName]; exists {
			return []byte(val)
		}

		metaPartName = strings.Replace(metaPartName, "resource.label.", "", 1)

		if val, exists := resourceLabels[metaPartName]; exists {
			return []byte(val)
		}

		return in
	})

	return string(result)
}
