package mysql

import (
	"context"
	"fmt"
	"sync"

	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

type MysqlExecutor struct {
	*models.DataSource
	engine *xorm.Engine
	log    log.Logger
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

func NewMysqlExecutor(datasource *models.DataSource) (tsdb.Executor, error) {
	engine, err := getEngineFor(datasource)
	if err != nil {
		return nil, err
	}

	return &MysqlExecutor{
		log:    log.New("tsdb.mysql"),
		engine: engine,
	}, nil
}

func getEngineFor(ds *models.DataSource) (*xorm.Engine, error) {
	engineCache.Lock()
	defer engineCache.Unlock()

	if engine, present := engineCache.cache[ds.Id]; present {
		if version, _ := engineCache.versions[ds.Id]; version == ds.Version {
			return engine, nil
		}
	}

	cnnstr := fmt.Sprintf("%s:%s@%s(%s)/%s?charset=utf8mb4", ds.User, ds.Password, "tcp", ds.Url, ds.Database)
	engine, err := xorm.NewEngine("mysql", cnnstr)
	engine.SetMaxConns(10)
	engine.SetMaxIdleConns(10)
	if err != nil {
		return nil, err
	}

	engineCache.cache[ds.Id] = engine
	return engine, nil
}

func init() {
	tsdb.RegisterExecutor("graphite", NewMysqlExecutor)
}

func (e *MysqlExecutor) Execute(ctx context.Context, queries tsdb.QuerySlice, context *tsdb.QueryContext) *tsdb.BatchResult {
	result := &tsdb.BatchResult{}

	session := engine.NewSession()
	defer session.Close()

	db := session.DB()
	result, err := getData(db, &req)

	if err != nil {
		return
	}
}

// func getData(db *core.DB, req *sqlDataRequest) (interface{}, error) {
// 	queries := strings.Split(req.Query, ";")
//
// 	data := dataStruct{}
// 	data.Results = make([]resultsStruct, 1)
// 	data.Results[0].Series = make([]seriesStruct, 0)
//
// 	for i := range queries {
// 		if queries[i] == "" {
// 			continue
// 		}
//
// 		rows, err := db.Query(queries[i])
// 		if err != nil {
// 			return nil, err
// 		}
// 		defer rows.Close()
//
// 		name := fmt.Sprintf("table_%d", i+1)
// 		series, err := arrangeResult(rows, name)
// 		if err != nil {
// 			return nil, err
// 		}
// 		data.Results[0].Series = append(data.Results[0].Series, series.(seriesStruct))
// 	}
//
// 	return data, nil
// }
//
// func arrangeResult(rows *core.Rows, name string) (interface{}, error) {
// 	columnNames, err := rows.Columns()
//
// 	series := seriesStruct{}
// 	series.Columns = columnNames
// 	series.Name = name
//
// 	for rows.Next() {
// 		columnValues := make([]interface{}, len(columnNames))
//
// 		err = rows.ScanSlice(&columnValues)
// 		if err != nil {
// 			return nil, err
// 		}
//
// 		// bytes -> string
// 		for i := range columnValues {
// 			switch columnValues[i].(type) {
// 			case []byte:
// 				columnValues[i] = fmt.Sprintf("%s", columnValues[i])
// 			}
// 		}
//
// 		series.Values = append(series.Values, columnValues)
// 	}
//
// 	return series, err
// }
//
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
