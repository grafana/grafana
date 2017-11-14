package cassandra

import (
	"context"
	"fmt"
	"github.com/gocql/gocql"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	"gopkg.in/inf.v0"
	"math"
	"math/big"
	"strconv"
	"strings"
	"sync"
)

type CassandraEndpoint struct {
	datasource   *models.DataSource
	cluster      *gocql.ClusterConfig
	session      *gocql.Session
	log          log.Logger
	sessionMutex sync.Mutex
}

func init() {
	tsdb.RegisterTsdbQueryEndpoint("cassandra", NewCassandraQueryEndpoint)
}

func NewCassandraQueryEndpoint(datasource *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	endpoint := &CassandraEndpoint{
		datasource: datasource,
		log:        log.New("tsdb.cassandra"),
	}

	if err := endpoint.initEngine(); err != nil {
		return nil, err
	}

	return endpoint, nil
}

func (e *CassandraEndpoint) getOrCreateSession() (*gocql.Session, error) {
	e.sessionMutex.Lock()
	defer e.sessionMutex.Unlock()

	var err error
	if e.session == nil || e.session.Closed() {
		e.session, err = e.cluster.CreateSession()
	}

	return e.session, err
}

func (e *CassandraEndpoint) initEngine() error {
	hosts, port, err := splitUrl(e.datasource.Url)
	if err != nil {
		return err
	}
	cluster := gocql.NewCluster(hosts...)
	cluster.Port = port

	cluster.Keyspace = e.datasource.Database
	cluster.ProtoVersion = e.datasource.JsonData.Get("protoVer").MustInt(0)

	consistencyStr := e.datasource.JsonData.Get("consistency").MustString()
	if consistency, err := gocql.ParseConsistencyWrapper(consistencyStr); err == nil {
		cluster.Consistency = consistency
	} else {
		return err
	}

	if e.datasource.User != "" {
		cluster.Authenticator = gocql.PasswordAuthenticator{
			Username: e.datasource.User,
			Password: e.datasource.Password,
		}
	}

	if sslCaPath := e.datasource.JsonData.Get("sslCaPath").MustString(); sslCaPath != "" {
		cluster.SslOpts = &gocql.SslOptions{
			CaPath: sslCaPath,
		}
	}

	e.sessionMutex.Lock()
	e.cluster = cluster
	e.session = nil
	e.sessionMutex.Unlock()

	_, err = e.getOrCreateSession()
	return err
}

func splitUrl(url string) ([]string, int, error) {
	hostsAndPort := strings.Split(url, ":")
	if len(hostsAndPort) == 2 {
		port, err := strconv.Atoi(hostsAndPort[1])
		return strings.Split(hostsAndPort[0], "--"), port, err
	} else {
		return strings.Split(url, "--"), 9042, nil
	}
}

func (e *CassandraEndpoint) Query(ctx context.Context, dsInfo *models.DataSource, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	queries := tsdbQuery.Queries
	result := &tsdb.Response{
		Results: make(map[string]*tsdb.QueryResult),
	}

	macroEngine := NewCassandraMacroEngine(tsdbQuery.TimeRange)
	session, err := e.getOrCreateSession()
	if err != nil {
		e.log.Error("Cassandra CreateSession error", "error", err)
	}

	for _, query := range queries {
		rawCql := query.Model.Get("rawSql").MustString()
		if rawCql == "" {
			continue
		}

		queryResult := &tsdb.QueryResult{Meta: simplejson.New(), RefId: query.RefId}
		result.Results[query.RefId] = queryResult

		rawCql, err := macroEngine.Interpolate(rawCql)
		if err != nil {
			queryResult.Error = err
			continue
		}

		queryResult.Meta.Set("sql", rawCql)

		e.log.Debug("Querying CQL", "rawCql", rawCql)
		sessionQuery := session.Query(rawCql)
		defer sessionQuery.Release()
		rows := sessionQuery.Iter()
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

	for k, v := range result.Results {
		e.log.Debug("Query Results", "key", k, "value", v)
	}
	return result, nil
}

func (e CassandraEndpoint) TransformToTable(query *tsdb.Query, rows *gocql.Iter, result *tsdb.QueryResult) error {
	table := &tsdb.Table{
		Columns: make([]tsdb.TableColumn, len(rows.Columns())),
		Rows:    make([]tsdb.RowValues, 0),
	}

	for i, columnInfo := range rows.Columns() {
		table.Columns[i].Text = columnInfo.Name
	}

	rowData, err := rows.RowData()
	if err != nil {
		return err
	}

	rowCount := 0
	for ; rows.Scan(rowData.Values...); rowCount += 1 {
		table.Rows = append(table.Rows, rowData.Values)
	}

	result.Tables = append(result.Tables, table)
	result.Meta.Set("rowCount", rowCount)
	return rows.Close()
}

func (e CassandraEndpoint) TransformToTimeSeries(query *tsdb.Query, rows *gocql.Iter, result *tsdb.QueryResult) error {
	pointsBySeries := make(map[string]*tsdb.TimeSeries)

	data, err := rows.RowData()
	if err != nil {
		return err
	}

	rowData := NewStringStringScan(data)
	rowCount := 0

	for ; ; rowCount += 1 {
		exist, err := rowData.update(rows)
		if err != nil {
			return fmt.Errorf("Cassandra row parsing error: %v", err)
		}
		if !exist {
			break
		}
		if !rowData.time.Valid {
			return fmt.Errorf("Found row with no time value")
		}
		if rowData.metric == "" {
			rowData.metric = "Unknown"
		}

		if series, exist := pointsBySeries[rowData.metric]; exist {
			series.Points = append(series.Points, tsdb.TimePoint{rowData.value, rowData.time})
		} else {
			series := &tsdb.TimeSeries{Name: rowData.metric}
			series.Points = append(series.Points, tsdb.TimePoint{rowData.value, rowData.time})
			pointsBySeries[rowData.metric] = series
		}
	}

	for _, value := range pointsBySeries {
		result.Series = append(result.Series, value)
	}

	result.Meta.Set("rowCount", rowCount)
	return rows.Close()
}

type stringStringScan struct {
	rowPtrs     []interface{}
	columnNames []string
	columnCount int

	time   null.Float
	value  null.Float
	metric string
}

func NewStringStringScan(rowData gocql.RowData) *stringStringScan {
	len := len(rowData.Columns)

	s := &stringStringScan{
		columnCount: len,
		columnNames: rowData.Columns,
		rowPtrs:     rowData.Values,
	}

	return s
}

func (s *stringStringScan) update(rows *gocql.Iter) (bool, error) {
	if exist := rows.Scan(s.rowPtrs...); !exist {
		return false, nil
	}
	exist := true
	s.time = null.FloatFromPtr(nil)
	s.value = null.FloatFromPtr(nil)

	for i := 0; i < s.columnCount; i++ {
		switch s.columnNames[i] {
		case "time_ms":
			if time, ok := ToFloat64(s.rowPtrs[i]); ok {
				s.time = null.FloatFrom(time)
			} else {
				return exist, fmt.Errorf("Cannot convert index %d column %s from %T to *float64", i, s.columnNames[i], s.rowPtrs[i])
			}
		case "value":
			if value, ok := ToFloat64(s.rowPtrs[i]); ok {
				s.value = null.FloatFrom(value)
			} else {
				return exist, fmt.Errorf("Cannot convert index %d column %s from %T to *float64", i, s.columnNames[i], s.rowPtrs[i])
			}
		case "metric":
			if value, ok := s.rowPtrs[i].(*string); ok {
				s.metric = *value
			} else {
				return exist, fmt.Errorf("Cannot convert index %d column %s from %T to *string", i, s.columnNames[i], s.rowPtrs[i])
			}
		}
	}
	return exist, nil
}

// Convert all possible cassandra-go numeric types to float64. See gocql/helpers.go:goType()
func ToFloat64(pi interface{}) (float64, bool) {
	switch pi.(type) {
	case **inf.Dec:
		val := *pi.(**inf.Dec)
		if unscaled, ok := val.Unscaled(); ok {
			scale := int(val.Scale())
			return float64(unscaled) * math.Pow10(-scale), true
		}
	case *float64:
		val := *pi.(*float64)
		return val, true
	case *float32:
		val := *pi.(*float32)
		return float64(val), true
	case **big.Int:
		val := *pi.(**big.Int)
		return float64(val.Int64()), true
	case *int64:
		val := *pi.(*int64)
		return float64(val), true
	case *int32:
		val := *pi.(*int32)
		return float64(val), true
	case *int16:
		val := *pi.(*int16)
		return float64(val), true
	case *int8:
		val := *pi.(*int8)
		return float64(val), true
	case *int:
		val := *pi.(*int)
		return float64(val), true
	}
	return -1, false
}
