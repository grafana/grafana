package stackdriver

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/tsdb"
)

func (e *StackdriverExecutor) executeAnnotationQuery(ctx context.Context, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	result := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}

	firstQuery := tsdbQuery.Queries[0]

	queries, err := e.buildQueries(tsdbQuery)
	if err != nil {
		return nil, err
	}

	queryRes, resp, err := e.executeQuery(ctx, queries[0], tsdbQuery)
	if err != nil {
		return nil, err
	}
	title := firstQuery.Model.Get("title").MustString()
	text := firstQuery.Model.Get("text").MustString()
	tags := firstQuery.Model.Get("tags").MustString()
	err = e.parseToAnnotations(queryRes, resp, queries[0], title, text, tags)
	result.Results[firstQuery.RefId] = queryRes

	return result, err
}

func (e *StackdriverExecutor) parseToAnnotations(queryRes *tsdb.QueryResult, data stackdriverResponse, query *stackdriverQuery, title string, text string, tags string) error {
	annotations := make([]map[string]string, 0)

	for _, series := range data.TimeSeries {
		// reverse the order to be ascending
		for i := len(series.Points) - 1; i >= 0; i-- {
			point := series.Points[i]
			value := strconv.FormatFloat(point.Value.DoubleValue, 'f', 6, 64)
			if series.ValueType == "STRING" {
				value = point.Value.StringValue
			}
			annotation := make(map[string]string)
			annotation["time"] = point.Interval.EndTime.UTC().Format(time.RFC3339)
			annotation["title"] = formatAnnotationText(title, value, series.Metric.Type, series.Metric.Labels, series.Resource.Labels)
			annotation["tags"] = tags
			annotation["text"] = formatAnnotationText(text, value, series.Metric.Type, series.Metric.Labels, series.Resource.Labels)
			annotations = append(annotations, annotation)
		}
	}

	transformAnnotationToTable(annotations, queryRes)
	return nil
}

func transformAnnotationToTable(data []map[string]string, result *tsdb.QueryResult) {
	table := &tsdb.Table{
		Columns: make([]tsdb.TableColumn, 4),
		Rows:    make([]tsdb.RowValues, 0),
	}
	table.Columns[0].Text = "time"
	table.Columns[1].Text = "title"
	table.Columns[2].Text = "tags"
	table.Columns[3].Text = "text"

	for _, r := range data {
		values := make([]interface{}, 4)
		values[0] = r["time"]
		values[1] = r["title"]
		values[2] = r["tags"]
		values[3] = r["text"]
		table.Rows = append(table.Rows, values)
	}
	result.Tables = append(result.Tables, table)
	result.Meta.Set("rowCount", len(data))
	slog.Info("anno", "len", len(data))
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
