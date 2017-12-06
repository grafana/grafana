package mssql

import (
	"container/list"
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"

	_ "time"

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
			return fmt.Errorf("MsSQL query row limit exceeded, limit %d", rowLimit)
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

	rowData := NewStringStringScan(columnNames)
	rowLimit := 1000
	rowCount := 0

	for ; rows.Next(); rowCount++ {
		if rowCount > rowLimit {
			return fmt.Errorf("MsSQL query row limit exceeded, limit %d", rowLimit)
		}

		err := rowData.Update(rows.Rows)
		if err != nil {
			e.log.Error("MsSQL response parsing", "error", err)
			return fmt.Errorf("MsSQL response parsing error %v", err)
		}

		if rowData.metric == "" {
			rowData.metric = "Unknown"
		}

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

	s.time = null.FloatFromPtr(nil)
	s.value = null.FloatFromPtr(nil)

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
