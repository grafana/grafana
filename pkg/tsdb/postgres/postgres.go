package postgres

import (
	"container/list"
	"context"
	"database/sql"
	"fmt"
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

type PostgresqlExecutor struct {
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
	tsdb.RegisterExecutor("postgres", NewPostgresqlExecutor)
}

func NewPostgresqlExecutor(datasource *models.DataSource) (tsdb.Executor, error) {
	executor := &PostgresqlExecutor{
		datasource: datasource,
		log:        log.New("tsdb.postgres"),
	}

	err := executor.initEngine()
	if err != nil {
		return nil, err
	}

	return executor, nil
}

func (e *PostgresqlExecutor) initEngine() error {
	engineCache.Lock()
	defer engineCache.Unlock()

	if engine, present := engineCache.cache[e.datasource.Id]; present {
		if version, _ := engineCache.versions[e.datasource.Id]; version == e.datasource.Version {
			e.engine = engine
			return nil
		}
	}

	cnnstr := fmt.Sprintf("postgres://%s:%s@%s/%s", e.datasource.User, e.datasource.Password, e.datasource.Url, e.datasource.Database)
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

func (e *PostgresqlExecutor) Execute(ctx context.Context, queries tsdb.QuerySlice, context *tsdb.QueryContext) *tsdb.BatchResult {
	result := &tsdb.BatchResult{
		QueryResults: make(map[string]*tsdb.QueryResult),
	}

	macroEngine := NewPostgresqlMacroEngine(context.TimeRange)
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

func (e PostgresqlExecutor) TransformToTable(query *tsdb.Query, rows *core.Rows, result *tsdb.QueryResult) error {
	columnNames, err := rows.Columns()
	columnCount := len(columnNames)

	if err != nil {
		return err
	}

	table := &tsdb.Table{
		Columns: make([]tsdb.TableColumn, columnCount),
		Rows:    make([]tsdb.RowValues, 0),
	}

	for i, name := range columnNames {
		table.Columns[i].Text = name
	}

	columnTypes, err := rows.ColumnTypes()
	if err != nil {
		return err
	}

	rowLimit := 1000000
	rowCount := 0

	for ; rows.Next(); rowCount++ {
		if rowCount > rowLimit {
			return fmt.Errorf("PostgreSQL query row limit exceeded, limit %d", rowLimit)
		}

		values, err := e.getTypedRowData(columnTypes, rows)
		if err != nil {
			return err
		}

		table.Rows = append(table.Rows, values)
	}

	result.Tables = append(result.Tables, table)
	result.Meta.Set("rowCount", rowCount)
	return nil
}

func (e PostgresqlExecutor) getTypedRowData(types []*sql.ColumnType, rows *core.Rows) (tsdb.RowValues, error) {
	values := make([]interface{}, len(types))

	for i, stype := range types {
		e.log.Debug("type", "type", stype)

		var ii interface{}
		values[i] = &ii
	}

	if err := rows.Scan(values...); err != nil {
		return nil, err
	}

	return values, nil
}

type RowData struct {
	time   null.Float
	value  null.Float
	metric string
}

func (e PostgresqlExecutor) TransformToTimeSeries(query *tsdb.Query, rows *core.Rows, result *tsdb.QueryResult) error {
	pointsBySeries := make(map[string]*tsdb.TimeSeries)
	seriesByQueryOrder := list.New()

	columnNames, err := rows.Columns()
	if err != nil {
		return err
	}
	columnCount := len(columnNames)
	values := make([]interface{}, columnCount)
	valuePtrs := make([]interface{}, columnCount)

	rowLimit := 1000000
	rowCount := 0

	for ; rows.Next(); rowCount++ {
		rowData := RowData{}

		if rowCount > rowLimit {
			return fmt.Errorf("PostgreSQL query row limit exceeded, limit %d", rowLimit)
		}

		for i, _ := range columnNames {
			valuePtrs[i] = &values[i]
		}

		rows.Scan(valuePtrs...)

		for i, col := range columnNames {
			var v interface{}
			val := values[i]

			if b, ok := val.([]byte); ok == true {
				v = string(b)
			} else {
				v = val
			}

			switch col {
			case "time":
				if t, ok := v.(float64); ok == true {
					rowData.time = null.FloatFrom(float64(t * 1000))
				}
				if t, ok := v.(time.Time); ok == true {
					rowData.time = null.FloatFrom(float64(t.Unix() * 1000))
				}
			case "value":
				if value, ok := v.(float64); ok == true {
					rowData.value = null.FloatFrom(value)
				}
			case "metric":
				if m, ok := v.(string); ok == true {
					rowData.metric = m
				}
			}

		}

		if rowData.metric == "" {
			rowData.metric = "Unknown"
		}

		e.log.Debug("Rows", "metric", rowData.metric, "time", rowData.time, "value", rowData.value)

		if !rowData.time.Valid {
			return fmt.Errorf("Found row with no time value")
		}

		if series, exist := pointsBySeries[rowData.metric]; exist {
			series.Points = append(series.Points, tsdb.TimePoint{rowData.value, rowData.time})
		} else {
			series := &tsdb.TimeSeries{Name: rowData.metric}
			series.Points = append(series.Points, tsdb.TimePoint{rowData.value, rowData.time})
			pointsBySeries[rowData.metric] = series
			seriesByQueryOrder.PushBack(rowData.metric)
		}
	}

	for elem := seriesByQueryOrder.Front(); elem != nil; elem = elem.Next() {
		key := elem.Value.(string)
		result.Series = append(result.Series, pointsBySeries[key])
	}

	result.Meta.Set("rowCount", rowCount)
	return nil
}

