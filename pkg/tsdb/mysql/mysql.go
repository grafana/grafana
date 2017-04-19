package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"sync"

	"github.com/go-xorm/core"
	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

type MysqlExecutor struct {
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
	tsdb.RegisterExecutor("mysql", NewMysqlExecutor)
}

func NewMysqlExecutor(datasource *models.DataSource) (tsdb.Executor, error) {
	executor := &MysqlExecutor{
		datasource: datasource,
		log:        log.New("tsdb.mysql"),
	}

	err := executor.initEngine()
	if err != nil {
		return nil, err
	}

	return executor, nil
}

func (e *MysqlExecutor) initEngine() error {
	engineCache.Lock()
	defer engineCache.Unlock()

	if engine, present := engineCache.cache[e.datasource.Id]; present {
		if version, _ := engineCache.versions[e.datasource.Id]; version == e.datasource.Version {
			e.engine = engine
			return nil
		}
	}

	cnnstr := fmt.Sprintf("%s:%s@%s(%s)/%s?charset=utf8mb4&parseTime=true&loc=UTC", e.datasource.User, e.datasource.Password, "tcp", e.datasource.Url, e.datasource.Database)
	e.log.Debug("getEngine", "connection", cnnstr)

	engine, err := xorm.NewEngine("mysql", cnnstr)
	engine.SetMaxOpenConns(10)
	engine.SetMaxIdleConns(10)
	if err != nil {
		return err
	}

	engineCache.cache[e.datasource.Id] = engine
	e.engine = engine
	return nil
}

func (e *MysqlExecutor) Execute(ctx context.Context, queries tsdb.QuerySlice, context *tsdb.QueryContext) *tsdb.BatchResult {
	result := &tsdb.BatchResult{
		QueryResults: make(map[string]*tsdb.QueryResult),
	}

	session := e.engine.NewSession()
	defer session.Close()
	db := session.DB()

	for _, query := range queries {
		rawSql := query.Model.Get("rawSql").MustString()
		if rawSql == "" {
			continue
		}

		rows, err := db.Query(rawSql)
		if err != nil {
			result.QueryResults[query.RefId] = &tsdb.QueryResult{Error: err}
			continue
		}

		defer rows.Close()

		res, err := e.TransformToTimeSeries(query, rows)
		if err != nil {
			result.Error = err
			return result
		}

		result.QueryResults[query.RefId] = &tsdb.QueryResult{RefId: query.RefId, Series: res}
	}

	return result
}

func (e MysqlExecutor) TransformToTimeSeries(query *tsdb.Query, rows *core.Rows) (tsdb.TimeSeriesSlice, error) {
	pointsBySeries := make(map[string]*tsdb.TimeSeries)
	columnNames, err := rows.Columns()

	if err != nil {
		return nil, err
	}

	rowData := NewStringStringScan(columnNames)
	rowLimit := 1000000
	rowCount := 0

	for ; rows.Next(); rowCount += 1 {
		if rowCount > rowLimit {
			return nil, fmt.Errorf("MySQL query row limit exceeded, limit %d", rowLimit)
		}

		err := rowData.Update(rows.Rows)
		if err != nil {
			e.log.Error("MySQL response parsing", "error", err)
			return nil, fmt.Errorf("MySQL response parsing error %v", err)
		}

		if rowData.metric == "" {
			rowData.metric = "Unknown"
		}

		//e.log.Debug("Rows", "metric", rowData.metric, "time", rowData.time, "value", rowData.value)

		if !rowData.time.Valid {
			return nil, fmt.Errorf("Found row with no time value")
		}

		if series, exist := pointsBySeries[rowData.metric]; exist {
			series.Points = append(series.Points, tsdb.TimePoint{rowData.value, rowData.time})
		} else {
			series := &tsdb.TimeSeries{Name: rowData.metric}
			series.Points = append(series.Points, tsdb.TimePoint{rowData.value, rowData.time})
			pointsBySeries[rowData.metric] = series
		}
	}

	seriesList := make(tsdb.TimeSeriesSlice, 0)
	for _, value := range pointsBySeries {
		seriesList = append(seriesList, value)
	}

	e.log.Debug("TransformToTimeSeries", "rowCount", rowCount, "timeSeriesCount", len(seriesList))
	return seriesList, nil
}

type stringStringScan struct {
	rowPtrs     []interface{}
	rowValues   []string
	columnNames []string
	columnCount int

	time   null.Float
	value  null.Float
	metric string
}

func NewStringStringScan(columnNames []string) *stringStringScan {
	s := &stringStringScan{
		columnCount: len(columnNames),
		columnNames: columnNames,
		rowPtrs:     make([]interface{}, len(columnNames)),
		rowValues:   make([]string, len(columnNames)),
	}

	for i := 0; i < s.columnCount; i++ {
		s.rowPtrs[i] = new(sql.RawBytes)
	}

	return s
}

func (s *stringStringScan) Update(rows *sql.Rows) error {
	if err := rows.Scan(s.rowPtrs...); err != nil {
		return err
	}

	for i := 0; i < s.columnCount; i++ {
		if rb, ok := s.rowPtrs[i].(*sql.RawBytes); ok {
			s.rowValues[i] = string(*rb)

			switch s.columnNames[i] {
			case "time_sec":
				if sec, err := strconv.ParseInt(s.rowValues[i], 10, 64); err == nil {
					s.time = null.FloatFrom(float64(sec * 1000))
				}
			case "value":
				if value, err := strconv.ParseFloat(s.rowValues[i], 64); err == nil {
					s.value = null.FloatFrom(value)
				}
			case "metric":
				s.metric = s.rowValues[i]
			}

			*rb = nil // reset pointer to discard current value to avoid a bug
		} else {
			return fmt.Errorf("Cannot convert index %d column %s to type *sql.RawBytes", i, s.columnNames[i])
		}
	}
	return nil
}
