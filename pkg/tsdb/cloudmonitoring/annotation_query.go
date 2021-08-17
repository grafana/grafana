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

func (s *Service) executeAnnotationQuery(ctx context.Context, tsdbQuery *backend.QueryDataRequest, dsInfo datasourceInfo) (
	*backend.QueryDataResponse, error) {
	// result := plugins.DataResponse{
	// 	Results: make(map[string]plugins.DataQueryResult),
	// }
	result := backend.NewQueryDataResponse()
	firstQuery := tsdbQuery.Queries[0]

	queries, err := s.buildQueryExecutors(tsdbQuery)
	if err != nil {
		return result, err
	}

	queryRes, resp, _, err := queries[0].run(ctx, tsdbQuery, s, dsInfo)
	if err != nil {
		return result, err
	}

	// metricQuery := firstQuery.Model.Get("metricQuery")
	metricQuery := MetricQuery{}
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
	// table := plugins.DataTable{
	// 	Columns: make([]plugins.DataTableColumn, 4),
	// 	Rows:    make([]plugins.DataRowValues, 0),
	// }
	frames := data.Frames{}

	// table.Columns[0].Text = "time"
	// table.Columns[1].Text = "title"
	// table.Columns[2].Text = "tags"
	// table.Columns[3].Text = "text"

	for _, r := range annotationData {
		// values := make([]interface{}, 4)
		// values[0] = r["time"]
		// values[1] = r["title"]
		// values[2] = r["tags"]
		// values[3] = r["text"]
		// table.Rows = append(table.Rows, values)
		frame := &data.Frame{
			Name: "Table",
			Fields: []*data.Field{
				data.NewField("time", nil, r["time"]),
				data.NewField("title", nil, r["title"]),
				data.NewField("tags", nil, r["tags"]),
				data.NewField("text", nil, r["text"]),
			},
			Meta: &data.FrameMeta{
				// Custom: interface,
			},
		}
		frames = append(frames, frame)
	}
	// result.Tables = append(result.Tables, table)
	// result.Meta.Set("rowCount", len(data))
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
