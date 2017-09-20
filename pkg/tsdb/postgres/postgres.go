package postgres

import (
	"container/list"
	"context"
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/go-xorm/core"
	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

type PostgresExecutor struct {
	datasource *models.DataSource
	engine     *xorm.Engine
	log        log.Logger
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

func init() {
	tsdb.RegisterExecutor("postgres", NewPostgresExecutor)
}

func NewPostgresExecutor(datasource *models.DataSource) (tsdb.Executor, error) {
	executor := &PostgresExecutor{
		datasource: datasource,
		log:        log.New("tsdb.postgres"),
	}

	err := executor.initEngine()
	if err != nil {
		return nil, err
	}

	return executor, nil
}

func (e *PostgresExecutor) initEngine() error {
	engineCache.Lock()
	defer engineCache.Unlock()

	if engine, present := engineCache.cache[e.datasource.Id]; present {
		if version, _ := engineCache.versions[e.datasource.Id]; version == e.datasource.Version {
			e.engine = engine
			return nil
		}
	}

	sslmode := e.datasource.JsonData.Get("sslmode").MustString("require")
	cnnstr := fmt.Sprintf("postgres://%s:%s@%s/%s?sslmode=%s", e.datasource.User, e.datasource.Password, e.datasource.Url, e.datasource.Database, sslmode)
	e.log.Debug("getEngine", "connection", cnnstr)

	engine, err := xorm.NewEngine("postgres", cnnstr)
	engine.SetMaxOpenConns(10)
	engine.SetMaxIdleConns(10)
	if err != nil {
		return err
	}

	engineCache.cache[e.datasource.Id] = engine
	e.engine = engine
	return nil
}

func (e *PostgresExecutor) Execute(ctx context.Context, queries tsdb.QuerySlice, context *tsdb.QueryContext) *tsdb.BatchResult {
	result := &tsdb.BatchResult{
		QueryResults: make(map[string]*tsdb.QueryResult),
	}

	macroEngine := NewPostgresMacroEngine(context.TimeRange)
	session := e.engine.NewSession()
	defer session.Close()
	db := session.DB()

	for _, query := range queries {
		rawSql := query.Model.Get("rawSql").MustString()
		if rawSql == "" {
			continue
		}

		queryResult := &tsdb.QueryResult{Meta: simplejson.New(), RefId: query.RefId}
		result.QueryResults[query.RefId] = queryResult

		rawSql, err := macroEngine.Interpolate(rawSql)
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
			err := e.TransformToTimeSeries(query, rows, queryResult)
			if err != nil {
				queryResult.Error = err
				continue
			}
		case "table":
			err := e.TransformToTable(query, rows, queryResult)
			if err != nil {
				queryResult.Error = err
				continue
			}
		}
	}

	return result
}

func (e PostgresExecutor) TransformToTable(query *tsdb.Query, rows *core.Rows, result *tsdb.QueryResult) error {

	columnNames, err := rows.Columns()
	if err != nil {
		return err
	}

	table := &tsdb.Table{
		Columns: make([]tsdb.TableColumn, len(columnNames)),
		Rows:    make([]tsdb.RowValues, 0),
	}

	for i, name := range columnNames {
		table.Columns[i].Text = name
	}

	rowLimit := 1000000
	rowCount := 0

	for ; rows.Next(); rowCount++ {
		if rowCount > rowLimit {
			return fmt.Errorf("PostgreSQL query row limit exceeded, limit %d", rowLimit)
		}

		values, err := e.getTypedRowData(rows)
		if err != nil {
			return err
		}

		table.Rows = append(table.Rows, values)
	}

	result.Tables = append(result.Tables, table)
	result.Meta.Set("rowCount", rowCount)
	return nil
}

func (e PostgresExecutor) getTypedRowData(rows *core.Rows) (tsdb.RowValues, error) {

	types, err := rows.ColumnTypes()
	if err != nil {
		return nil, err
	}

	values := make([]interface{}, len(types))
	valuePtrs := make([]interface{}, len(types))

	for i, _ := range types {
		valuePtrs[i] = &values[i]
	}

	if err := rows.Scan(valuePtrs...); err != nil {
		return nil, err
	}

	return values, nil
}

func (e PostgresExecutor) TransformToTimeSeries(query *tsdb.Query, rows *core.Rows, result *tsdb.QueryResult) error {
	pointsBySeries := make(map[string]*tsdb.TimeSeries)
	seriesByQueryOrder := list.New()

	columnNames, err := rows.Columns()
	if err != nil {
		return err
	}

	rowLimit := 1000000
	rowCount := 0
	timeIndex := -1
	metricIndex := -1

	// check columns of resultset
	for i, col := range columnNames {
		switch col {
		case "time":
			timeIndex = i
		case "metric":
			metricIndex = i
		}
	}

	if timeIndex == -1 {
		return fmt.Errorf("Found no column named time")
	}

	for rows.Next() {
		var timestamp float64
		var value null.Float
		var metric string

		if rowCount > rowLimit {
			return fmt.Errorf("PostgreSQL query row limit exceeded, limit %d", rowLimit)
		}

		values, err := e.getTypedRowData(rows)
		if err != nil {
			return err
		}

		switch columnValue := values[timeIndex].(type) {
		case int64:
			timestamp = float64(columnValue * 1000)
		case float64:
			timestamp = columnValue * 1000
		case time.Time:
			timestamp = float64(columnValue.Unix() * 1000)
		default:
			return fmt.Errorf("Found row with no valid time value")
		}

		if metricIndex >= 0 {
			switch columnValue := values[metricIndex].(type) {
			case string:
				metric = columnValue
			case []byte: // char is not converted to a go string but returned as []byte
				metric = string(columnValue)
			}
		}

		for i, col := range columnNames {
			if i == timeIndex {
				break
			}

			switch columnValue := values[i].(type) {
			case int64:
				value = null.FloatFrom(float64(columnValue))
			case float64:
				value = null.FloatFrom(columnValue)
			case []byte: // decimal is not converted to a go type but returned as []byte
				v, err := strconv.ParseFloat(string(columnValue), 64)
				if err == nil {
					value = null.FloatFrom(v)
				}
			default:
				return fmt.Errorf("Unknown datatype in column %s: type: %T value: %v", col, columnValue, columnValue)
			}
			if metricIndex == -1 {
				metric = col
			}
			e.appendTimePoint(pointsBySeries, seriesByQueryOrder, metric, timestamp, value)
			rowCount++

		}
	}

	for elem := seriesByQueryOrder.Front(); elem != nil; elem = elem.Next() {
		key := elem.Value.(string)
		result.Series = append(result.Series, pointsBySeries[key])
	}

	result.Meta.Set("rowCount", rowCount)
	return nil
}

func (e PostgresExecutor) appendTimePoint(pointsBySeries map[string]*tsdb.TimeSeries, seriesByQueryOrder *list.List, metric string, timestamp float64, value null.Float) {
	if series, exist := pointsBySeries[metric]; exist {
		series.Points = append(series.Points, tsdb.TimePoint{value, null.FloatFrom(timestamp)})
	} else {
		series := &tsdb.TimeSeries{Name: metric}
		series.Points = append(series.Points, tsdb.TimePoint{value, null.FloatFrom(timestamp)})
		pointsBySeries[metric] = series
		seriesByQueryOrder.PushBack(metric)
	}
	e.log.Debug("Rows", "metric", metric, "time", timestamp, "value", value)
}
