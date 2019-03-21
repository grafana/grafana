package metaqueries

import (
	"context"
	"fmt"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/go-plugin"
	"net/http"
	"reflect"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

type MetaqueriesExecutor struct {
	plugin.NetRPCUnsupportedPlugin
	logger     hclog.Logger
	HttpClient *http.Client
}

func NewMetaqueriesExecutor(datasource *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	return &MetaqueriesExecutor{}, nil
}

var mlog = log.New("tsdb.metaqueries")

func init() {
	tsdb.RegisterTsdbQueryEndpoint("metaqueries", NewMetaqueriesExecutor)
}

func (e *MetaqueriesExecutor) Query(ctx context.Context, dsInfo *models.DataSource, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {

	println(tsdbQuery.Queries)
	var response = &tsdb.Response{Results: make(map[string]*tsdb.QueryResult)}
	var err error
	fmt.Println("test fmt,", tsdbQuery.Queries[0].Model)
	fmt.Println("test fmt,", reflect.TypeOf(tsdbQuery.Queries[0].Model))

	//&{map[datasource:MetaQueries metric:ct outputMetricName:Day 7 periods:-7 query:A queryType:TimeShift refId:B]}
	modelJson := tsdbQuery.Queries[0].Model
	queryType := modelJson.Get("queryType").MustString()
	if queryType == "TimeShift" {
		response, err = e.timeShift(ctx, dsInfo, modelJson, tsdbQuery)
	}

	println(response)
	return response, err
}

func (e *MetaqueriesExecutor) timeShift(ctx context.Context, dsInfo *models.DataSource, modelJson *simplejson.Json, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {

	periodsToShift, err1 := strconv.Atoi(modelJson.Get("periods").MustString())
	if err1 != nil {
		// handle error
	}

	query := modelJson.Get("query").MustString()

	FromEpochMs, error1 := strconv.ParseInt(strconv.FormatInt(tsdbQuery.TimeRange.GetFromAsMsEpoch(), 10)[0:10], 10, 64)
	ToEpochMs, error2 := strconv.ParseInt(strconv.FormatInt(tsdbQuery.TimeRange.GetToAsMsEpoch(), 10)[0:10], 10, 64)
	if error1 != nil {
	}
	if error2 != nil {
	}

	from := time.Unix(int64(FromEpochMs), 0).AddDate(0, 0, periodsToShift)
	to := time.Unix(int64(ToEpochMs), 0)
	shiftedTo := to.AddDate(0, 0, periodsToShift)

	fmt.Println("from ", from.UTC().String())
	fmt.Println("to ", shiftedTo.UTC().String())

	tsdbQuery.TimeRange.From = strconv.Itoa(int(from.Unix()))
	tsdbQuery.TimeRange.To = strconv.Itoa(int(shiftedTo.Unix()))

	fmt.Println("tsdbQuery.TimeRange.From ", tsdbQuery.TimeRange.From)
	fmt.Println("tsdbQuery.TimeRange.To ", tsdbQuery.TimeRange.To)

	var response *tsdb.Response
	var err error

	for i := 0; i < len(tsdbQuery.Queries); i++ {

		targetRefId := tsdbQuery.Queries[i].Model.Get("refId").MustString()

		if targetRefId == query {

			targetQueryType := tsdbQuery.Queries[i].Model.Get("queryType").MustString()
			targetDataSource := tsdbQuery.Queries[i].Model.Get("datasource").MustString()

			if targetDataSource == "MetaQueries" && targetQueryType == "TimeShift" {
				tsdbQuery.Queries[0] = tsdbQuery.Queries[i]
				response, err = e.timeShift(ctx, tsdbQuery.Queries[i].DataSource, tsdbQuery.Queries[i].Model, tsdbQuery)

			} else if tsdbQuery.Queries[i].Model.Get("druidDS") != nil {

				druidQuery := tsdbQuery.Queries[i]
				var druid *tsdb.TsdbQuery
				druid = tsdbQuery
				for i := 0; i < len(druid.Queries); i++ {
					druid.Queries = append(druid.Queries[:i], druid.Queries[i+1:]...)
				}
				druid.Queries[len(druid.Queries)-1] = nil
				druid.Queries = []*tsdb.Query{}

				druid.Queries = append(druid.Queries, druidQuery)

				response, err = tsdb.HandleRequest(ctx, druid.Queries[0].DataSource, druid)

				fmt.Println("error message ", err)
				fmt.Println("response message ", len(response.Results))
				fmt.Println(reflect.TypeOf(response))
				return response, err
			}
		}
	}
	fmt.Println("test response", err)
	fmt.Println("test response ", len(response.Results))
	return response, err
}
