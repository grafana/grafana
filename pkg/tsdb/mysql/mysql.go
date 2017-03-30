package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"sync"

	"github.com/go-xorm/xorm"
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

	cnnstr := fmt.Sprintf("%s:%s@%s(%s)/%s?charset=utf8mb4", e.datasource.User, e.datasource.Password, "tcp", e.datasource.Url, e.datasource.Database)
	e.log.Debug("getEngine", "connection", cnnstr)

	engine, err := xorm.NewEngine("mysql", cnnstr)
	engine.SetMaxConns(10)
	engine.SetMaxIdleConns(10)
	if err != nil {
		return err
	}

	engineCache.cache[e.datasource.Id] = engine
	e.engine = engine
	return nil
}

func (e *MysqlExecutor) Execute(ctx context.Context, queries tsdb.QuerySlice, context *tsdb.QueryContext) *tsdb.BatchResult {
	result := &tsdb.BatchResult{}

	session := e.engine.NewSession()
	defer session.Close()

	db := session.DB()

	// queries := strings.Split(req.Query, ";")
	//
	// data := dataStruct{}
	// data.Results = make([]resultsStruct, 1)
	// data.Results[0].Series = make([]seriesStruct, 0)

	for _, query := range queries {
		rawSql := query.Model.Get("rawSql").MustString()
		if rawSql == "" {
			continue
		}

		rows, err := db.Query(rawSql)
		if err != nil {
			result.Error = err
			return result
		}
		defer rows.Close()

		columnNames, err := rows.Columns()
		if err != nil {
			result.Error = err
			return result
		}

		rc := NewStringStringScan(columnNames)
		for rows.Next() {
			err := rc.Update(rows.Rows)
			if err != nil {
				e.log.Error("Mysql response parsing", "error", err)
				result.Error = err
				return result
			}

			rowValues := rc.Get()
			e.log.Info("Rows", "row", rowValues)
		}

		// for rows.Next() {
		// 	columnValues := make([]interface{}, len(columnNames))
		//
		// 	err = rows.ScanSlice(&columnValues)
		// 	if err != nil {
		// 		result.Error = err
		// 		return result
		// 	}
		//
		// 	// bytes -> string
		// 	for i := range columnValues {
		// 		rowType := reflect.TypeOf(columnValues[i])
		// 		e.log.Info("row", "type", rowType)
		//
		// 		rawValue := reflect.Indirect(reflect.ValueOf(columnValues[i]))
		//
		// 		// if rawValue is null then ignore
		// 		if rawValue.Interface() == nil {
		// 			continue
		// 		}
		//
		// 		rawValueType := reflect.TypeOf(rawValue.Interface())
		// 		vv := reflect.ValueOf(rawValue.Interface())
		// 		e.log.Info("column type", "name", columnNames[i], "type", rawValueType, "vv", vv)
		// 	}
		// }
	}

	return result
}

type stringStringScan struct {
	// cp are the column pointers
	cp []interface{}
	// row contains the final result
	row      []string
	colCount int
	colNames []string
}

func NewStringStringScan(columnNames []string) *stringStringScan {
	lenCN := len(columnNames)
	s := &stringStringScan{
		cp:       make([]interface{}, lenCN),
		row:      make([]string, lenCN*2),
		colCount: lenCN,
		colNames: columnNames,
	}
	j := 0
	for i := 0; i < lenCN; i++ {
		s.cp[i] = new(sql.RawBytes)
		s.row[j] = s.colNames[i]
		j = j + 2
	}
	return s
}

func (s *stringStringScan) Update(rows *sql.Rows) error {
	if err := rows.Scan(s.cp...); err != nil {
		return err
	}
	j := 0
	for i := 0; i < s.colCount; i++ {
		if rb, ok := s.cp[i].(*sql.RawBytes); ok {
			s.row[j+1] = string(*rb)
			*rb = nil // reset pointer to discard current value to avoid a bug
		} else {
			return fmt.Errorf("Cannot convert index %d column %s to type *sql.RawBytes", i, s.colNames[i])
		}
		j = j + 2
	}
	return nil
}

func (s *stringStringScan) Get() []string {
	return s.row
}

// type sqlDataRequest struct {
// 	Query string `json:"query"`
// 	Body  []byte `json:"-"`
// }
//
// type seriesStruct struct {
// 	Columns []string        `json:"columns"`
// 	Name    string          `json:"name"`
// 	Values  [][]interface{} `json:"values"`
// }
//
// type resultsStruct struct {
// 	Series []seriesStruct `json:"series"`
// }
//
// type dataStruct struct {
// 	Results []resultsStruct `json:"results"`
// }
