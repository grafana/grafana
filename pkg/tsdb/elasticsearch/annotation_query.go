package elasticsearch

import (
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

type annotationQuery struct {
	client    es.Client
	tsdbQuery *tsdb.TsdbQuery
}

var newAnnotationQuery = func(client es.Client, tsdbQuery *tsdb.TsdbQuery) queryEndpoint {
	return &annotationQuery{
		client:    client,
		tsdbQuery: tsdbQuery,
	}
}

func (e *annotationQuery) execute() (*tsdb.Response, error) {
	query := e.tsdbQuery.Queries[0]
	at, ok := query.Model.CheckGet("annotation")
	if !ok {
		return nil, fmt.Errorf("required property annotation is missing")
	}
	queryModel := annotationQueryModel{
		timeField:   at.Get("timeField").MustString(e.client.GetTimeField()),
		tagsField:   at.Get("tagsField").MustString("tags"),
		textField:   at.Get("textField").MustString(),
		queryString: at.Get("query").MustString(),
		refID:       query.RefId,
	}

	interval := tsdb.Interval{}
	from := fmt.Sprintf("%d", e.tsdbQuery.TimeRange.GetFromAsMsEpoch())
	to := fmt.Sprintf("%d", e.tsdbQuery.TimeRange.GetToAsMsEpoch())

	b := e.client.Search(interval)
	b.Size(10000)
	filters := b.Query().Bool().Filter()
	filters.AddDateRangeFilter(queryModel.timeField, to, from, es.DateFormatEpochMS)

	if queryModel.queryString != "" {
		filters.AddQueryStringFilter(queryModel.queryString, true)
	}

	req, err := b.Build()
	if err != nil {
		return nil, err
	}

	if e.client.GetVersion() < 5 {
		req.CustomProps["fields"] = []string{queryModel.timeField, "_source"}
	}

	res, err := e.client.ExecuteSearch(req)
	if err != nil {
		return nil, err
	}

	rt := newAnnotationQueryResponseTransformer(res, &queryModel)
	return rt.transform()
}

type annotationQueryResponseTransformer struct {
	response *es.SearchResponse
	model    *annotationQueryModel
}

var newAnnotationQueryResponseTransformer = func(response *es.SearchResponse, m *annotationQueryModel) responseTransformer {
	return &annotationQueryResponseTransformer{
		response: response,
		model:    m,
	}
}

func (rp *annotationQueryResponseTransformer) transform() (*tsdb.Response, error) {
	res := rp.response
	queryModel := rp.model

	if res.Error != nil {
		return &tsdb.Response{
			Results: map[string]*tsdb.QueryResult{
				rp.model.refID: getErrorFromElasticResponse(res.Error),
			},
		}, nil
	}

	table := tsdb.Table{
		Columns: make([]tsdb.TableColumn, 0),
		Rows:    make([]tsdb.RowValues, 0),
	}

	table.Columns = append(table.Columns, tsdb.TableColumn{Text: "time"})
	table.Columns = append(table.Columns, tsdb.TableColumn{Text: "text"})
	table.Columns = append(table.Columns, tsdb.TableColumn{Text: "tags"})

	getFieldFromSource := func(source *simplejson.Json, fieldName string) interface{} {
		if fieldName == "" {
			return nil
		}

		fieldNames := strings.Split(fieldName, ".")
		return source.GetPath(fieldNames...).Interface()
	}

	if res.Hits != nil && len(res.Hits.Hits) > 0 {
		for _, v := range res.Hits.Hits {
			hit := simplejson.NewFromAny(v)
			source := hit.Get("_source")
			extractedTime := getFieldFromSource(source, queryModel.timeField)
			text := getFieldFromSource(source, queryModel.textField)
			tags := getFieldFromSource(source, queryModel.tagsField)

			if fieldsProp, ok := hit.CheckGet("fields"); ok {
				_, intErr := fieldsProp.Get(queryModel.timeField).Int64()
				_, strErr := fieldsProp.Get(queryModel.timeField).String()

				if intErr == nil || strErr == nil {
					extractedTime = fieldsProp.Get(queryModel.timeField).Interface()
				}

			}

			var timeMs int64
			switch timeVal := extractedTime.(type) {
			case float64:
				timeMs = int64(timeVal)
			case string:
				if t, err := time.Parse(time.RFC3339, timeVal); err == nil {
					timeMs = t.UTC().UnixNano() / int64(time.Millisecond)
				}
			}

			if t, ok := tags.(string); ok {
				tags = strings.Split(t, ",")
			}

			table.Rows = append(table.Rows, tsdb.RowValues{timeMs, text, tags})
		}
	}

	result := tsdb.Response{
		Results: map[string]*tsdb.QueryResult{
			rp.model.refID: {
				RefId:  rp.model.refID,
				Tables: []*tsdb.Table{&table},
			},
		},
	}

	return &result, nil
}
