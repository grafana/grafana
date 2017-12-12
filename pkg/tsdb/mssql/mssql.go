package mssql

import (
	"container/list"
	"context"
	"database/sql"
	"fmt"
	"strings"

	"time"

	_ "github.com/denisenkom/go-mssqldb"
	"github.com/go-xorm/core"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

type MssqlQueryEndpoint struct {
	sqlEngine tsdb.SqlEngine
	log       log.Logger
}

func init() {
	tsdb.RegisterTsdbQueryEndpoint("mssql", NewMssqlQueryEndpoint)
}

func NewMssqlQueryEndpoint(datasource *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	endpoint := &MssqlQueryEndpoint{
		log: log.New("tsdb.mssql"),
	}

	endpoint.sqlEngine = &tsdb.DefaultSqlEngine{
		MacroEngine: NewMssqlMacroEngine(),
	}

	serport := datasource.Url
	// fix me: need to have a default port if user did not provide. i.e. 1433
	words := strings.Split(serport, ":")
	server, port := words[0], words[1]
	cnnstr := fmt.Sprintf("server=%s;port=%s;database=%s;user id=%s;password=%s;",
		server,
		port,
		datasource.Database,
		datasource.User,
		datasource.Password,
	)
	endpoint.log.Debug("getEngine", "connection", cnnstr)

	if err := endpoint.sqlEngine.InitEngine("mssql", datasource, cnnstr); err != nil {
		return nil, err
	}

	return endpoint, nil
}

// Query is the main function for the MssqlExecutor
func (e *MssqlQueryEndpoint) Query(ctx context.Context, dsInfo *models.DataSource, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	return e.sqlEngine.Query(ctx, dsInfo, tsdbQuery, e.transformToTimeSeries, e.transformToTable)
}

func (e MssqlQueryEndpoint) transformToTable(query *tsdb.Query, rows *core.Rows, result *tsdb.QueryResult) error {
	columnNames, err := rows.Columns()
	columnCount := len(columnNames)

	if err != nil {
		return err
	}

	rowLimit := 1000000
	rowCount := 0
	timeIndex := -1

	table := &tsdb.Table{
		Columns: make([]tsdb.TableColumn, columnCount),
		Rows:    make([]tsdb.RowValues, 0),
	}

	for i, name := range columnNames {
		table.Columns[i].Text = name

		// check if there is a column named time
		switch name {
		case "time":
			timeIndex = i
		}
	}

	columnTypes, err := rows.ColumnTypes()
	if err != nil {
		return err
	}

	for ; rows.Next(); rowCount++ {
		if rowCount > rowLimit {
			return fmt.Errorf("MsSQL query row limit exceeded, limit %d", rowLimit)
		}

		values, err := e.getTypedRowData(columnTypes, rows)
		if err != nil {
			return err
		}

		// convert column named time to unix timestamp to make
		// native datetime mssql types work in annotation queries
		if timeIndex != -1 {
			switch value := values[timeIndex].(type) {
			case time.Time:
				values[timeIndex] = float64(value.Unix())
			}
		}

		table.Rows = append(table.Rows, values)
	}

	result.Tables = append(result.Tables, table)
	result.Meta.Set("rowCount", rowCount)
	return nil
}

func (e MssqlQueryEndpoint) getTypedRowData(types []*sql.ColumnType, rows *core.Rows) (tsdb.RowValues, error) {
	values := make([]interface{}, len(types))
	valuePtrs := make([]interface{}, len(types))

	for i, stype := range types {
		e.log.Debug("type", "type", stype)
		valuePtrs[i] = &values[i]
	}

	if err := rows.Scan(valuePtrs...); err != nil {
		return nil, err
	}

	return values, nil
}

func (e MssqlQueryEndpoint) transformToTimeSeries(query *tsdb.Query, rows *core.Rows, result *tsdb.QueryResult) error {
	pointsBySeries := make(map[string]*tsdb.TimeSeries)
	seriesByQueryOrder := list.New()

	columnNames, err := rows.Columns()
	if err != nil {
		return err
	}

	columnTypes, err := rows.ColumnTypes()
	if err != nil {
		return err
	}

	rowLimit := 1000000
	rowCount := 0
	timeIndex := -1
	metricIndex := -1

	// check columns of resultset: a column named time is mandatory
	// the first text column is treated as metric name unless a column named metric is present
	for i, col := range columnNames {
		switch col {
		case "time":
			timeIndex = i
		case "metric":
			metricIndex = i
		default:
			if metricIndex == -1 {
				switch columnTypes[i].DatabaseTypeName() {
				case "VARCHAR", "CHAR", "NVARCHAR", "NCHAR":
					metricIndex = i
				}
			}
		}
	}

	if timeIndex == -1 {
		return fmt.Errorf("Found no column named time")
	}

	for rows.Next() {
		var timestamp float64
		var value null.Float
		var metricColVal string
		var metric string

		if rowCount > rowLimit {
			return fmt.Errorf("MSSQL query row limit exceeded, limit %d", rowLimit)
		}

		values, err := e.getTypedRowData(columnTypes, rows)
		if err != nil {
			return err
		}

		switch columnValue := values[timeIndex].(type) {
		case int64:
			timestamp = float64(columnValue * 1000)
		case float64:
			timestamp = columnValue * 1000
		case time.Time:
			timestamp = (float64(columnValue.Unix()) * 1000) + float64(columnValue.Nanosecond()/1e6) // in case someone is trying to map times beyond 2262 :D
		default:
			return fmt.Errorf("Invalid type for column time, must be of type timestamp or unix timestamp")
		}

		if metricIndex >= 0 {
			if columnValue, ok := values[metricIndex].(string); ok == true {
				metricColVal = columnValue
			} else {
				return fmt.Errorf("Column metric must be of type CHAR, VARCHAR, NCHAR or NVARCHAR. metric column name: %s type: %s but datatype is %T", columnNames[metricIndex], columnTypes[metricIndex].DatabaseTypeName(), values[metricIndex])
			}
		}

		for i, col := range columnNames {
			if i == timeIndex || i == metricIndex {
				continue
			}

			switch columnValue := values[i].(type) {
			case int64:
				value = null.FloatFrom(float64(columnValue))
			case float64:
				value = null.FloatFrom(columnValue)
			case nil:
				value.Valid = false
			default:
				return fmt.Errorf("Value column must have numeric datatype, column: %s type: %T value: %v", col, columnValue, columnValue)
			}

			// construct the metric name
			// if there is more than 3 columns (more than one value) and there is
			// a metric column, join them to make the metric name
			if metricIndex == -1 {
				metric = col
			} else if len(columnNames) > 3 {
				metric = metricColVal + " - " + col
			} else {
				metric = metricColVal
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

func (e MssqlQueryEndpoint) appendTimePoint(pointsBySeries map[string]*tsdb.TimeSeries, seriesByQueryOrder *list.List, metric string, timestamp float64, value null.Float) {
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
