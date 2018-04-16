package tsdb

import (
	"context"
	"sync"
	"time"

	"github.com/go-xorm/core"
	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
)

// SqlEngine is a wrapper class around xorm for relational database data sources.
type SqlEngine interface {
	InitEngine(driverName string, dsInfo *models.DataSource, cnnstr string) error
	Query(
		ctx context.Context,
		ds *models.DataSource,
		query *TsdbQuery,
		transformToTimeSeries func(query *Query, rows *core.Rows, result *QueryResult, tsdbQuery *TsdbQuery) error,
		transformToTable func(query *Query, rows *core.Rows, result *QueryResult, tsdbQuery *TsdbQuery) error,
	) (*Response, error)
}

// SqlMacroEngine interpolates macros into sql. It takes in the Query to have access to query context and
// timeRange to be able to generate queries that use from and to.
type SqlMacroEngine interface {
	Interpolate(query *Query, timeRange *TimeRange, sql string) (string, error)
}

type DefaultSqlEngine struct {
	MacroEngine SqlMacroEngine
	XormEngine  *xorm.Engine
}

type engineCacheType struct {
	cache    map[int64]*xorm.Engine
	versions map[int64]int
	sync.Mutex
}

var engineCache = engineCacheType{
	cache:    make(map[int64]*xorm.Engine),
	versions: make(map[int64]int),
}

// InitEngine creates the db connection and inits the xorm engine or loads it from the engine cache
func (e *DefaultSqlEngine) InitEngine(driverName string, dsInfo *models.DataSource, cnnstr string) error {
	engineCache.Lock()
	defer engineCache.Unlock()

	if engine, present := engineCache.cache[dsInfo.Id]; present {
		if version, _ := engineCache.versions[dsInfo.Id]; version == dsInfo.Version {
			e.XormEngine = engine
			return nil
		}
	}

	engine, err := xorm.NewEngine(driverName, cnnstr)
	if err != nil {
		return err
	}

	engine.SetMaxOpenConns(10)
	engine.SetMaxIdleConns(10)

	engineCache.cache[dsInfo.Id] = engine
	e.XormEngine = engine

	return nil
}

// Query is a default implementation of the Query method for an SQL data source.
// The caller of this function must implement transformToTimeSeries and transformToTable and
// pass them in as parameters.
func (e *DefaultSqlEngine) Query(
	ctx context.Context,
	dsInfo *models.DataSource,
	tsdbQuery *TsdbQuery,
	transformToTimeSeries func(query *Query, rows *core.Rows, result *QueryResult, tsdbQuery *TsdbQuery) error,
	transformToTable func(query *Query, rows *core.Rows, result *QueryResult, tsdbQuery *TsdbQuery) error,
) (*Response, error) {
	result := &Response{
		Results: make(map[string]*QueryResult),
	}

	session := e.XormEngine.NewSession()
	defer session.Close()
	db := session.DB()

	for _, query := range tsdbQuery.Queries {
		rawSql := query.Model.Get("rawSql").MustString()
		if rawSql == "" {
			continue
		}

		queryResult := &QueryResult{Meta: simplejson.New(), RefId: query.RefId}
		result.Results[query.RefId] = queryResult

		rawSql, err := e.MacroEngine.Interpolate(query, tsdbQuery.TimeRange, rawSql)
		if err != nil {
			queryResult.Error = err
			continue
		}

		queryResult.Meta.Set("sql", rawSql)

		rows, err := db.Query(rawSql)
		if err != nil {
			queryResult.Error = err
			continue
		}

		defer rows.Close()

		format := query.Model.Get("format").MustString("time_series")

		switch format {
		case "time_series":
			err := transformToTimeSeries(query, rows, queryResult, tsdbQuery)
			if err != nil {
				queryResult.Error = err
				continue
			}
		case "table":
			err := transformToTable(query, rows, queryResult, tsdbQuery)
			if err != nil {
				queryResult.Error = err
				continue
			}
		}
	}

	return result, nil
}

// ConvertSqlTimeColumnToEpochMs converts column named time to unix timestamp in milliseconds
// to make native datetime types and epoch dates work in annotation and table queries.
func ConvertSqlTimeColumnToEpochMs(values RowValues, timeIndex int) {
	if timeIndex >= 0 {
		switch value := values[timeIndex].(type) {
		case time.Time:
			values[timeIndex] = EpochPrecisionToMs(float64(value.UnixNano()))
		case *time.Time:
			if value != nil {
				values[timeIndex] = EpochPrecisionToMs(float64((*value).UnixNano()))
			}
		case int64:
			values[timeIndex] = int64(EpochPrecisionToMs(float64(value)))
		case *int64:
			if value != nil {
				values[timeIndex] = int64(EpochPrecisionToMs(float64(*value)))
			}
		case uint64:
			values[timeIndex] = int64(EpochPrecisionToMs(float64(value)))
		case *uint64:
			if value != nil {
				values[timeIndex] = int64(EpochPrecisionToMs(float64(*value)))
			}
		case int32:
			values[timeIndex] = int64(EpochPrecisionToMs(float64(value)))
		case *int32:
			if value != nil {
				values[timeIndex] = int64(EpochPrecisionToMs(float64(*value)))
			}
		case uint32:
			values[timeIndex] = int64(EpochPrecisionToMs(float64(value)))
		case *uint32:
			if value != nil {
				values[timeIndex] = int64(EpochPrecisionToMs(float64(*value)))
			}
		case float64:
			values[timeIndex] = EpochPrecisionToMs(value)
		case *float64:
			if value != nil {
				values[timeIndex] = EpochPrecisionToMs(*value)
			}
		case float32:
			values[timeIndex] = EpochPrecisionToMs(float64(value))
		case *float32:
			if value != nil {
				values[timeIndex] = EpochPrecisionToMs(float64(*value))
			}
		}
	}
}
