package cloudmonitoring

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type MetricQuery struct {
	Title string `json:"title"`
	Text  string `json:"text"`
	Tags  string `json:"tags"`
}

func (s *Service) executeAnnotationQuery(ctx context.Context, req *backend.QueryDataRequest, dsInfo datasourceInfo) (
	*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()
	firstQuery := req.Queries[0]

	queries, err := s.buildQueryExecutors(req)
	if err != nil {
		return result, err
	}

	queryRes, resp, _, err := queries[0].run(ctx, req, s, dsInfo)
	if err != nil {
		return result, err
	}

	// metricQuery := firstQuery.Model.Get("metricQuery")
	metricQuery := &MetricQuery{}
	err = json.Unmarshal(firstQuery.JSON, metricQuery)
	if err != nil {
		return result, nil
	}
	title := metricQuery.Title
	text := metricQuery.Text
	tags := metricQuery.Tags

	err = queries[0].parseToAnnotations(queryRes, resp, title, text, tags, firstQuery.RefID)
	result.Responses[firstQuery.RefID] = *queryRes

	return result, err
}

func transformAnnotationToFrame(annotationData []map[string]string, result *backend.DataResponse) {
	frames := data.Frames{}
	for _, r := range annotationData {
		frame := &data.Frame{
			Name: "Table",
			Fields: []*data.Field{
				data.NewField("time", nil, r["time"]),
				data.NewField("title", nil, r["title"]),
				data.NewField("tags", nil, r["tags"]),
				data.NewField("text", nil, r["text"]),
			},
			Meta: &data.FrameMeta{
				Custom: map[string]interface{}{
					"rowCount": len(r),
				},
			},
		}
		frames = append(frames, frame)
	}
	result.Frames = frames
	slog.Info("anno", "len", len(annotationData))
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
