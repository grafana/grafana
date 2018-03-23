package elasticsearch

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	"src/github.com/davecgh/go-spew/spew"
	"strconv"
	"strings"
	"time"
)

type ElasticSearchQueryParser struct {
	DsInfo    *models.DataSource
	TimeRange *tsdb.TimeRange
	Queries   []*tsdb.Query
	glog      log.Logger
}

func (qp *ElasticSearchQueryParser) Parse() (string, error) {
	payload := bytes.Buffer{}
	queryHeader := qp.getQueryHeader()

	for _, q := range qp.Queries {
		timeField, err := q.Model.Get("timeField").String()
		if err != nil {
			return "", err
		}
		rawQuery := q.Model.Get("query").MustString("")
		bucketAggs := q.Model.Get("bucketAggs").MustArray()
		metrics := q.Model.Get("metrics").MustArray()
		alias := q.Model.Get("alias").MustString("")
		builder := QueryBuilder{timeField, rawQuery, bucketAggs, metrics, alias}

		query, err := builder.Build()
		if err != nil {
			return "", err
		}
		queryBytes, err := json.Marshal(query)
		if err != nil {
			return "", err
		}

		payload.WriteString(queryHeader.String() + "\n")
		payload.WriteString(string(queryBytes) + "\n")
	}

	return qp.payloadReplace(payload.String(), qp.DsInfo.JsonData)

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
	header.Index = qp.getIndexList()

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

func (qp *ElasticSearchQueryParser) getIndexList() string {
	_, err := qp.DsInfo.JsonData.Get("interval").String()
	if err != nil {
		return qp.DsInfo.Database
	}
	// todo: support interval
	return qp.DsInfo.Database
}
