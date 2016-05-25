package sqldb

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"strings"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	// "github.com/grafana/grafana/pkg/util"

	_ "github.com/go-sql-driver/mysql"
	"github.com/go-xorm/core"
	"github.com/go-xorm/xorm"
	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
)

type sqlDataRequest struct {
	Query string `json:"query"`
	Body  []byte `json:"-"`
}

type seriesStruct struct {
	Columns []string        `json:"columns"`
	Name    string          `json:"name"`
	Values  [][]interface{} `json:"values"`
}

type resultsStruct struct {
	Series []seriesStruct `json:"series"`
}

type dataStruct struct {
	Results []resultsStruct `json:"results"`
}

func getEngine(ds *m.DataSource) (*xorm.Engine, error) {
	dbms, err := ds.JsonData.Get("dbms").String()
	if err != nil {
		return nil, errors.New("Invalid DBMS")
	}

	host, err := ds.JsonData.Get("host").String()
	if err != nil {
		return nil, errors.New("Invalid host")
	}

	port, err := ds.JsonData.Get("port").String()
	if err != nil {
		return nil, errors.New("Invalid port")
	}

	constr := ""

	switch dbms {
	case "mysql":
		constr = fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8",
			ds.User, ds.Password, host, port, ds.Database)

	case "postgres":
		sslEnabled, _ := ds.JsonData.Get("ssl").Bool()
		sslMode := "disable"
		if sslEnabled {
			sslMode = "require"
		}

		constr = fmt.Sprintf("user=%s password=%s host=%s port=%s dbname=%s sslmode=%s",
			ds.User, ds.Password, host, port, ds.Database, sslMode)

	default:
		return nil, fmt.Errorf("Unknown DBMS: %s", dbms)
	}

	return xorm.NewEngine(dbms, constr)
}

func getData(db *core.DB, req *sqlDataRequest) (interface{}, error) {
	queries := strings.Split(req.Query, ";")

	data := dataStruct{}
	data.Results = make([]resultsStruct, 1)
	data.Results[0].Series = make([]seriesStruct, 0)

	for i := range queries {
		if queries[i] == "" {
			continue
		}

		rows, err := db.Query(queries[i])
		if err != nil {
			return nil, err
		}
		defer rows.Close()

		name := fmt.Sprintf("table_%d", i+1)
		series, err := arrangeResult(rows, name)
		if err != nil {
			return nil, err
		}
		data.Results[0].Series = append(data.Results[0].Series, series.(seriesStruct))
	}

	return data, nil
}

func arrangeResult(rows *core.Rows, name string) (interface{}, error) {
	columnNames, err := rows.Columns()

	series := seriesStruct{}
	series.Columns = columnNames
	series.Name = name

	for rows.Next() {
		columnValues := make([]interface{}, len(columnNames))

		err = rows.ScanSlice(&columnValues)
		if err != nil {
			return nil, err
		}

		// bytes -> string
		for i := range columnValues {
			switch columnValues[i].(type) {
			case []byte:
				columnValues[i] = fmt.Sprintf("%s", columnValues[i])
			}
		}

		series.Values = append(series.Values, columnValues)
	}

	return series, err
}

func HandleRequest(c *middleware.Context, ds *m.DataSource) {
	var req sqlDataRequest
	req.Body, _ = ioutil.ReadAll(c.Req.Request.Body)
	json.Unmarshal(req.Body, &req)

	log.Debug("SQL request: query='%v'", req.Query)

	engine, err := getEngine(ds)
	if err != nil {
		c.JsonApiErr(500, "Unable to open SQL connection", err)
		return
	}
	defer engine.Close()

	session := engine.NewSession()
	defer session.Close()

	db := session.DB()

	result, err := getData(db, &req)
	if err != nil {
		c.JsonApiErr(500, fmt.Sprintf("Data error: %v, Query: %s", err.Error(), req.Query), err)
		return
	}

	c.JSON(200, result)
}
