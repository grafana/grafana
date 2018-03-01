package mysql

import (
	"container/list"
	"context"
	"database/sql"
	"fmt"
	"math"
	"reflect"
	"strconv"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/go-xorm/core"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

type MysqlQueryEndpoint struct {
	sqlEngine tsdb.SqlEngine
	log       log.Logger
}

func init() {
	tsdb.RegisterTsdbQueryEndpoint("mysql", NewMysqlQueryEndpoint)
}

func NewMysqlQueryEndpoint(datasource *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	endpoint := &MysqlQueryEndpoint{
		log: log.New("tsdb.mysql"),
	}

	endpoint.sqlEngine = &tsdb.DefaultSqlEngine{
		MacroEngine: NewMysqlMacroEngine(),
	}

	cnnstr := fmt.Sprintf("%s:%s@%s(%s)/%s?collation=utf8mb4_unicode_ci&parseTime=true&loc=UTC&allowNativePasswords=true",
		datasource.User,
		datasource.Password,
		"tcp",
		datasource.Url,
		datasource.Database,
	)
	endpoint.log.Debug("getEngine", "connection", cnnstr)

	if err := endpoint.sqlEngine.InitEngine("mysql", datasource, cnnstr); err != nil {
		return nil, err
	}

	return endpoint, nil
}

// Query is the main function for the MysqlExecutor
func (e *MysqlQueryEndpoint) Query(ctx context.Context, dsInfo *models.DataSource, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	return e.sqlEngine.Query(ctx, dsInfo, tsdbQuery, e.transformToTimeSeries, e.transformToTable)
}

func (e MysqlQueryEndpoint) transformToTable(query *tsdb.Query, rows *core.Rows, result *tsdb.QueryResult, tsdbQuery *tsdb.TsdbQuery) error {
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

	rowLimit := 1000000
	rowCount := 0
	timeIndex := -1

	// check if there is a column named time
	for i, col := range columnNames {
		switch col {
		case "time_sec":
			timeIndex = i
		}
	}

	for ; rows.Next(); rowCount++ {
		if rowCount > rowLimit {
			return fmt.Errorf("MySQL query row limit exceeded, limit %d", rowLimit)
		}

		values, err := e.getTypedRowData(rows)
		if err != nil {
			return err
		}

		// for annotations, convert to epoch
		if timeIndex != -1 {
			switch value := values[timeIndex].(type) {
			case time.Time:
				values[timeIndex] = float64(value.UnixNano() / 1e9)
			}
		}

		table.Rows = append(table.Rows, values)
	}

	result.Tables = append(result.Tables, table)
	result.Meta.Set("rowCount", rowCount)
	return nil
}

func (e MysqlQueryEndpoint) getTypedRowData(rows *core.Rows) (tsdb.RowValues, error) {
	types, err := rows.ColumnTypes()
	if err != nil {
		return nil, err
	}

	values := make([]interface{}, len(types))

	for i := range values {
		scanType := types[i].ScanType()
		values[i] = reflect.New(scanType).Interface()

		if types[i].DatabaseTypeName() == "BIT" {
			values[i] = new([]byte)
		}
	}

	if err := rows.Scan(values...); err != nil {
		return nil, err
	}

	for i := 0; i < len(types); i++ {
		typeName := reflect.ValueOf(values[i]).Type().String()

		switch typeName {
		case "*sql.RawBytes":
			values[i] = string(*values[i].(*sql.RawBytes))
		case "*mysql.NullTime":
			sqlTime := (*values[i].(*mysql.NullTime))
			if sqlTime.Valid {
				values[i] = sqlTime.Time
			} else {
				values[i] = nil
			}
		case "*sql.NullInt64":
			nullInt64 := (*values[i].(*sql.NullInt64))
			if nullInt64.Valid {
				values[i] = nullInt64.Int64
			} else {
				values[i] = nil
			}
		case "*sql.NullFloat64":
			nullFloat64 := (*values[i].(*sql.NullFloat64))
			if nullFloat64.Valid {
				values[i] = nullFloat64.Float64
			} else {
				values[i] = nil
			}
		}

		if types[i].DatabaseTypeName() == "DECIMAL" {
			f, err := strconv.ParseFloat(values[i].(string), 64)

			if err == nil {
				values[i] = f
			} else {
				values[i] = nil
			}
		}
	}

	return values, nil
}

func (e MysqlQueryEndpoint) transformToTimeSeries(query *tsdb.Query, rows *core.Rows, result *tsdb.QueryResult, tsdbQuery *tsdb.TsdbQuery) error {
	pointsBySeries := make(map[string]*tsdb.TimeSeries)
	seriesByQueryOrder := list.New()

	columnNames, err := rows.Columns()
	if err != nil {
		return err
	}

	rowData := NewStringStringScan(columnNames)
	rowLimit := 1000000
	rowCount := 0

	fillMissing := query.Model.Get("fill").MustBool(false)
	var fillInterval float64
	fillValue := null.Float{}
	if fillMissing {
		fillInterval = query.Model.Get("fillInterval").MustFloat64() * 1000
		if query.Model.Get("fillNull").MustBool(false) == false {
			fillValue.Float64 = query.Model.Get("fillValue").MustFloat64()
			fillValue.Valid = true
		}

	}

	for ; rows.Next(); rowCount++ {
		if rowCount > rowLimit {
			return fmt.Errorf("MySQL query row limit exceeded, limit %d", rowLimit)
		}

		err := rowData.Update(rows.Rows)
		if err != nil {
			e.log.Error("MySQL response parsing", "error", err)
			return fmt.Errorf("MySQL response parsing error %v", err)
		}

		if rowData.metric == "" {
			rowData.metric = "Unknown"
		}

		if !rowData.time.Valid {
			return fmt.Errorf("Found row with no time value")
		}

		series, exist := pointsBySeries[rowData.metric]
		if exist == false {
			series = &tsdb.TimeSeries{Name: rowData.metric}
			pointsBySeries[rowData.metric] = series
			seriesByQueryOrder.PushBack(rowData.metric)
		}

		if fillMissing {
			var intervalStart float64
			if exist == false {
				intervalStart = float64(tsdbQuery.TimeRange.MustGetFrom().UnixNano() / 1e6)
			} else {
				intervalStart = series.Points[len(series.Points)-1][1].Float64 + fillInterval
			}

			// align interval start
			intervalStart = math.Floor(intervalStart/fillInterval) * fillInterval

			for i := intervalStart; i < rowData.time.Float64; i += fillInterval {
				series.Points = append(series.Points, tsdb.TimePoint{fillValue, null.FloatFrom(i)})
				rowCount++
			}
		}

		series.Points = append(series.Points, tsdb.TimePoint{rowData.value, rowData.time})
	}

	for elem := seriesByQueryOrder.Front(); elem != nil; elem = elem.Next() {
		key := elem.Value.(string)
		result.Series = append(result.Series, pointsBySeries[key])

		if fillMissing {
			series := pointsBySeries[key]
			// fill in values from last fetched value till interval end
			intervalStart := series.Points[len(series.Points)-1][1].Float64
			intervalEnd := float64(tsdbQuery.TimeRange.MustGetTo().UnixNano() / 1e6)

			// align interval start
			intervalStart = math.Floor(intervalStart/fillInterval) * fillInterval
			for i := intervalStart + fillInterval; i < intervalEnd; i += fillInterval {
				series.Points = append(series.Points, tsdb.TimePoint{fillValue, null.FloatFrom(i)})
				rowCount++
			}
		}
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
