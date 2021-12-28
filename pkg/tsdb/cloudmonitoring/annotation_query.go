package cloudmonitoring

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func (s *Service) executeAnnotationQuery(ctx context.Context, req *backend.QueryDataRequest, dsInfo datasourceInfo) (
	*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()

	queries, err := s.buildQueryExecutors(req)
	if err != nil {
		return resp, err
	}

	queryRes, dr, _, err := queries[0].run(ctx, req, s, dsInfo)
	if err != nil {
		return resp, err
	}

	mq := struct {
		Title string `json:"title"`
		Text  string `json:"text"`
	}{}

	firstQuery := req.Queries[0]
	err = json.Unmarshal(firstQuery.JSON, &mq)
	if err != nil {
		return resp, nil
	}
	err = queries[0].parseToAnnotations(queryRes, dr, mq.Title, mq.Text)
	resp.Responses[firstQuery.RefID] = *queryRes

	return resp, err
}

func (timeSeriesQuery cloudMonitoringTimeSeriesQuery) transformAnnotationToFrame(annotations []map[string]string, result *backend.DataResponse) {
	frames := data.Frames{}
	for _, a := range annotations {
		frame := &data.Frame{
			RefID: timeSeriesQuery.getRefID(),
			Fields: []*data.Field{
				data.NewField("time", nil, a["time"]),
				data.NewField("title", nil, a["title"]),
				data.NewField("tags", nil, a["tags"]),
				data.NewField("text", nil, a["text"]),
			},
			Meta: &data.FrameMeta{
				Custom: map[string]interface{}{
					"rowCount": len(a),
				},
			},
		}
		frames = append(frames, frame)
	}
	result.Frames = frames
	slog.Info("anno", "len", len(annotations))
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
