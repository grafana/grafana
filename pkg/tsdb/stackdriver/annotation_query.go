package stackdriver

import (
	"context"
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

func (e *StackdriverExecutor) parseToAnnotations(queryRes *tsdb.QueryResult, data StackdriverResponse, query *StackdriverQuery, title string, text string, tags string) error {
	annotations := make([]map[string]string, 0)

	for _, series := range data.TimeSeries {
		// reverse the order to be ascending
		for i := len(series.Points) - 1; i >= 0; i-- {
			point := series.Points[i]

			annotation := make(map[string]string)
			annotation["time"] = point.Interval.EndTime.UTC().Format(time.RFC3339)
			annotation["title"] = title
			annotation["tags"] = tags
			annotation["text"] = text
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

// func (e *StackdriverExecutor) buildAnnotationQuery(tsdbQuery *tsdb.TsdbQuery) (*StackdriverQuery, error) {
// 	firstQuery := queryContext.Queries[0]

// 	metricType := query.Model.Get("metricType").MustString()
// 	filterParts := query.Model.Get("filters").MustArray()
// 	filterString := buildFilterString(metricType, filterParts)
// 	params := url.Values{}
// 	params.Add("interval.startTime", startTime.UTC().Format(time.RFC3339))
// 	params.Add("interval.endTime", endTime.UTC().Format(time.RFC3339))
// 	params.Add("filter", buildFilterString(metricType, filterParts))
// 	params.Add("view", "FULL")

// 	return &StackdriverQuery{
// 		RefID:  firstQuery.RefID,
// 		Params: params,
// 		Target: "",
// 	}, nil
// }
