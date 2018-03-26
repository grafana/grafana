package elasticsearch

import (
	"fmt"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/leibowitz/moment"
	"strings"
	"time"
)

type ElasticSearchQueryParser struct {
}

func (qp *ElasticSearchQueryParser) Parse(model *simplejson.Json, dsInfo *models.DataSource) (*Query, error) {
	//payload := bytes.Buffer{}
	//queryHeader := qp.getQueryHeader()
	timeField, err := model.Get("timeField").String()
	if err != nil {
		return nil, err
	}
	rawQuery := model.Get("query").MustString("")
	bucketAggs := model.Get("bucketAggs").MustArray()
	metrics := model.Get("metrics").MustArray()
	alias := model.Get("alias").MustString("")
	parsedInterval, err := tsdb.GetIntervalFrom(dsInfo, model, time.Millisecond)
	if err != nil {
		return nil, err
	}

	return &Query{timeField,
		rawQuery,
		bucketAggs,
		metrics,
		alias,
		parsedInterval}, nil
}

func getRequestHeader(timeRange *tsdb.TimeRange, dsInfo *models.DataSource) *QueryHeader {
	var header QueryHeader
	esVersion := dsInfo.JsonData.Get("esVersion").MustInt()

	searchType := "query_then_fetch"
	if esVersion < 5 {
		searchType = "count"
	}
	header.SearchType = searchType
	header.IgnoreUnavailable = true
	header.Index = getIndexList(dsInfo.Database, dsInfo.JsonData.Get("interval").MustString(""), timeRange)

	if esVersion >= 56 {
		header.MaxConcurrentShardRequests = dsInfo.JsonData.Get("maxConcurrentShardRequests").MustInt()
	}
	return &header
}

func getIndexList(pattern string, interval string, timeRange *tsdb.TimeRange) string {
	if interval == "" {
		return pattern
	}

	var indexes []string
	indexParts := strings.Split(strings.TrimLeft(pattern, "["), "]")
	indexBase := indexParts[0]
	if len(indexParts) <= 1 {
		return pattern
	}

	indexDateFormat := indexParts[1]

	start := moment.NewMoment(timeRange.MustGetFrom())
	end := moment.NewMoment(timeRange.MustGetTo())

	indexes = append(indexes, fmt.Sprintf("%s%s", indexBase, start.Format(indexDateFormat)))
	for start.IsBefore(*end) {
		switch interval {
		case "Hourly":
			start = start.AddHours(1)

		case "Daily":
			start = start.AddDay()

		case "Weekly":
			start = start.AddWeeks(1)

		case "Monthly":
			start = start.AddMonths(1)

		case "Yearly":
			start = start.AddYears(1)
		}
		indexes = append(indexes, fmt.Sprintf("%s%s", indexBase, start.Format(indexDateFormat)))
	}
	return strings.Join(indexes, ",")
}
