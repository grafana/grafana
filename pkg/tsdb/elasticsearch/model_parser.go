package elasticsearch

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/leibowitz/moment"
	"src/github.com/davecgh/go-spew/spew"
	"strconv"
	"strings"
	"time"
)

type ElasticSearchQueryParser struct {
	DsInfo    *models.DataSource
	TimeRange *tsdb.TimeRange
	Queries   []*tsdb.Query
}

func (qp *ElasticSearchQueryParser) Parse() (string, []*QueryBuilder, error) {
	payload := bytes.Buffer{}
	queryHeader := qp.getQueryHeader()
	targets := make([]*QueryBuilder, 0)
	for _, q := range qp.Queries {
		timeField, err := q.Model.Get("timeField").String()
		if err != nil {
			return "", nil, err
		}
		rawQuery := q.Model.Get("query").MustString("")
		bucketAggs := q.Model.Get("bucketAggs").MustArray()
		metrics := q.Model.Get("metrics").MustArray()
		alias := q.Model.Get("alias").MustString("")
		builder := QueryBuilder{timeField, rawQuery, bucketAggs, metrics, alias}
		targets = append(targets, &builder)

		query, err := builder.Build()
		if err != nil {
			return "", nil, err
		}
		queryBytes, err := json.Marshal(query)
		if err != nil {
			return "", nil, err
		}

		payload.WriteString(queryHeader.String() + "\n")
		payload.WriteString(string(queryBytes) + "\n")
	}
	p, err := qp.payloadReplace(payload.String(), qp.DsInfo.JsonData)

	return p, targets, err

}

func (qp *ElasticSearchQueryParser) getQueryHeader() *QueryHeader {
	var header QueryHeader
	esVersion := qp.DsInfo.JsonData.Get("esVersion").MustInt()

	searchType := "query_then_fetch"
	if esVersion < 5 {
		searchType = "count"
	}
	header.SearchType = searchType
	header.IgnoreUnavailable = true
	header.Index = getIndexList(qp.DsInfo.Database, qp.DsInfo.JsonData.Get("interval").MustString(""), qp.TimeRange)

	if esVersion >= 56 {
		header.MaxConcurrentShardRequests = qp.DsInfo.JsonData.Get("maxConcurrentShardRequests").MustInt()
	}
	return &header
}
func (qp *ElasticSearchQueryParser) payloadReplace(payload string, model *simplejson.Json) (string, error) {
	parsedInterval, err := tsdb.GetIntervalFrom(qp.DsInfo, model, time.Millisecond)
	if err != nil {
		return "", nil
	}

	interval := intervalCalculator.Calculate(qp.TimeRange, parsedInterval)
	glog.Warn(spew.Sdump(interval))
	payload = strings.Replace(payload, "$timeFrom", fmt.Sprintf("%d", qp.TimeRange.GetFromAsMsEpoch()), -1)
	payload = strings.Replace(payload, "$timeTo", fmt.Sprintf("%d", qp.TimeRange.GetToAsMsEpoch()), -1)
	payload = strings.Replace(payload, "$interval", interval.Text, -1)
	payload = strings.Replace(payload, "$__interval_ms", strconv.FormatInt(interval.Value.Nanoseconds()/int64(time.Millisecond), 10), -1)
	payload = strings.Replace(payload, "$__interval", interval.Text, -1)

	return payload, nil
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
