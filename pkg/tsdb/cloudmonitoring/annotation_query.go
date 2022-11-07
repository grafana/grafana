package cloudmonitoring

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/infra/log"
)

type annotationEvent struct {
	Title string
	Time  time.Time
	Tags  string
	Text  string
}

func (s *Service) executeAnnotationQuery(ctx context.Context, logger log.Logger, req *backend.QueryDataRequest, dsInfo datasourceInfo) (
	*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	queries, err := s.buildQueryExecutors(logger, req)
	if err != nil {
		return resp, err
	}

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
	err = queries[0].parseToAnnotations(queryRes, dr, mq.MetricQuery.Title, mq.MetricQuery.Text)
	resp.Responses[firstQuery.RefID] = *queryRes

	return resp, err
}

func (timeSeriesQuery cloudMonitoringTimeSeriesQuery) transformAnnotationToFrame(annotations []*annotationEvent, result *backend.DataResponse) {
	frame := data.NewFrame(timeSeriesQuery.RefID,
		data.NewField("time", nil, []time.Time{}),
		data.NewField("title", nil, []string{}),
		data.NewField("tags", nil, []string{}),
		data.NewField("text", nil, []string{}),
	)
	for _, a := range annotations {
		frame.AppendRow(a.Time, a.Title, a.Tags, a.Text)
	}
	result.Frames = append(result.Frames, frame)
	timeSeriesQuery.logger.Info("anno", "len", len(annotations))
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
