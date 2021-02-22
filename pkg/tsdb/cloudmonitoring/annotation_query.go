package cloudmonitoring

import (
	"context"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/tsdb"
	"strings"
)

func (e *CloudMonitoringExecutor) executeAnnotationQuery(ctx context.Context, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	result := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}

	firstQuery := tsdbQuery.Queries[0]

	queries, err := e.buildQueryExecutors(tsdbQuery)
	if err != nil {
		return nil, err
	}

	queryRes, resp, executedQuery, err := queries[0].run(ctx, tsdbQuery, e)
	if err != nil {
		return nil, err
	}

	err = queries[0].parseResponse(queryRes, resp, executedQuery)
	if err != nil {
		queryRes.Error = err
	}

	metricQuery := firstQuery.Model.Get("metricQuery")
	title := metricQuery.Get("title").MustString()
	text := metricQuery.Get("text").MustString()
	tags := metricQuery.Get("tags").MustString()

	transformToDataframes(queryRes, title, tags, text)

	err = queries[0].parseToAnnotations(queryRes, resp, title, text, tags)
	result.Results[firstQuery.RefId] = queryRes

	return result, err
}

func transformToDataframes(queryRes *tsdb.QueryResult, title string, tags string, text string) {
	frames, _ := queryRes.Dataframes.Decoded()
	for i := range frames {
		frames[i].Fields[0].Name = "time"

		emptyArr := make([]string, frames[i].Fields[0].Len())
		labels := frames[i].Fields[1].Labels
		frames[i].Fields = data.Fields{
			frames[i].Fields[0],
			data.NewField(title, labels, emptyArr),
			data.NewField(tags, labels, emptyArr),
			data.NewField(text, labels, emptyArr),
		}
	}
	queryRes.Dataframes = tsdb.NewDecodedDataFrames(frames)
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
