package crate

import (
	"context"
	"database/sql"
	_ "encoding/json"
	"fmt"
	_ "io/ioutil"
	_ "net/http"
	"net/url"
	_ "net/url"
	_ "path"
	"strconv"
	_ "strings"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	_ "github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
	_ "github.com/herenow/go-crate"
	_ "golang.org/x/net/context/ctxhttp"
)

type CrateExecutor struct {
}

func NewCrateExecutor(datasource *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	return &CrateExecutor{}, nil
}

var (
	plog log.Logger
)

func init() {
	plog = log.New("tsdb.crate")
	tsdb.RegisterTsdbQueryEndpoint("crate-datasource", NewCrateExecutor)
}
func (e *CrateExecutor) Query(ctx context.Context, dsInfo *models.DataSource, queryContext *tsdb.TsdbQuery) (*tsdb.Response, error) {
	dsJson, err := dsInfo.JsonData.Map()
	if err != nil {
		plog.Info("Failed to create datasource info", err)
	}
	timeColumn := dsJson["timeColumn"].(string)
	schema := dsJson["schema"].(string)
	table := dsJson["table"].(string)
	dsUrl := dsInfo.Url
	if len(dsInfo.BasicAuthUser) > 0 && len(dsInfo.BasicAuthPassword) > 0 {
		u, err := url.Parse(dsInfo.Url)
		if err != nil {
			plog.Info("Failed to parse datasource URL", err)
		}
		dsUrl = u.Scheme + "://" + dsInfo.BasicAuthUser + ":" + dsInfo.BasicAuthPassword + "@" + u.Host
	}
	result := &tsdb.Response{}
	start := queryContext.TimeRange.GetFromAsMsEpoch()
	startTime := strconv.FormatInt(start, 10)
	end := queryContext.TimeRange.GetToAsMsEpoch()
	endTime := strconv.FormatInt(end, 10)
	db, err := sql.Open("crate", dsUrl)
	if err != nil {
		plog.Info("Failed to open connection to datasource", err)
	}
	queryResults := make(map[string]*tsdb.QueryResult)
	for _, query := range queryContext.Queries {
		q, err := query.Model.Map()
		if err != nil {
			plog.Info("Failed to create query model map", err)
		}
		m, err := query.Model.Get("metricAggs").Array()
		if err != nil {
			plog.Info("Failed to create query model metric aggregate array", err)
		}
		metricColumn := m[0].(map[string]interface{})["column"].(string)
		refID := q["refId"].(string)
		queryString := fmt.Sprintf("SELECT %s,%s FROM %s.%s WHERE %s>%s AND %s<%s;", timeColumn, metricColumn, schema, table, timeColumn, startTime, timeColumn, endTime)
		rows, err := db.Query(queryString)
		if err != nil {
			plog.Info("Query to datasource failed", err)
		}
		defer rows.Close()
		queryRes := tsdb.NewQueryResult()
		series := tsdb.TimeSeries{
			Name: metricColumn,
		}
		for rows.Next() {
			var timeValue string
			var metricValue string
			if err := rows.Scan(&timeValue, &metricValue); err != nil {
				plog.Info("Failed to scan rows for time and metric values", err)
			}
			point, err := parseDbValues(timeValue, metricValue)
			if err != nil {
				plog.Info("Failed to create time series point", err)
			}
			series.Points = append(series.Points, *point)
		}
		if err := rows.Err(); err != nil {
			plog.Info("Failed to parse row in datasource query response", err)
		}
		queryRes.Series = append(queryRes.Series, &series)
		queryResults[refID] = queryRes
	}
	result.Results = queryResults
	return result, nil
}

func parseDbValues(timeValue string, metricValue string) (*tsdb.TimePoint, error) {
	floatTimeValue, err := strconv.ParseFloat(timeValue, 64)
	if err != nil {
		plog.Info("Failed to parse time value as float", err)
		return nil, err
	}
	floatMetricValue, err := strconv.ParseFloat(metricValue, 64)
	if err != nil {
		plog.Info("Failed to parse metric value as float", err)
		return nil, err
	}
	point := tsdb.NewTimePoint(null.FloatFrom(floatMetricValue), floatTimeValue)
	return &point, nil
}
