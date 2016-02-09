// Copyright 2016 Foursquare Labs, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package sqlds

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"reflect"
	"strings"
	"time"

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
	From  int64  `json:"from"`
	To    int64  `json:"to"`
	Body  []byte `json:"-"`
}

func getEngine(ds *m.DataSource) (*xorm.Engine, error) {
	dbTypeRaw, ok1 := ds.JsonData["sqlDBType"]
	if !ok1 {
		return nil, errors.New("Cannot deserialize sqlDBType")
	}
	dbType, ok2 := dbTypeRaw.(string)
	if !ok2 {
		return nil, errors.New("Cannot convert sqlDBType")
	}

	hostPortRaw, ok3 := ds.JsonData["sqlHost"]
	if !ok3 {
		return nil, errors.New("Cannot deserialize sqlHost")
	}
	hostPort, ok4 := hostPortRaw.(string)
	if !ok4 {
		return nil, errors.New("Cannot convert sqlHost")
	}

	cnnstr := ""
	switch dbType {
	case "mysql":
		cnnstr = fmt.Sprintf("%s:%s@tcp(%s)/%s?charset=utf8",
			ds.User, ds.Password, hostPort, ds.Database)

	case "postgres":
		var host, port = "127.0.0.1", "5432"
		fields := strings.Split(hostPort, ":")
		if len(fields) > 0 && len(strings.TrimSpace(fields[0])) > 0 {
			host = fields[0]
		}
		if len(fields) > 1 && len(strings.TrimSpace(fields[1])) > 0 {
			port = fields[1]
		}
		cnnstr = fmt.Sprintf("user=%s password=%s host=%s port=%s dbname=%s sslmode=%s",
			ds.User, ds.Password, host, port, ds.Database, "disable")

	default:
		return nil, fmt.Errorf("Unknown database type: %s", dbType)
	}

	return xorm.NewEngine(dbType, cnnstr)
}

type datapointStruct struct {
	Timestamp time.Time
	Value     float64
	IsNull    bool
}

type timeseriesStruct struct {
	Name       string
	Datapoints []datapointStruct
}

func decodeTimestamp(rawTimestamp interface{}) (time.Time, error) {
	if rawTimestamp == nil {
		return time.Unix(0, 0), errors.New("Timestamp must not be NULL")
	}

	switch rawTimestamp.(type) {
	case time.Time:
		return rawTimestamp.(time.Time), nil

	case int64:
		return time.Unix(rawTimestamp.(int64), 0), nil

	case float64:
		return time.Unix(int64(rawTimestamp.(float64)), 0), nil

	default:
		return time.Unix(0, 0), fmt.Errorf("Invalid type for timestamp: %v", reflect.TypeOf(rawTimestamp))
	}
}

func decodeValue(rawValue interface{}) (float64, bool, error) {
	if rawValue == nil {
		return 0, false, nil
	}

	switch rawValue.(type) {
	case float64:
		return rawValue.(float64), true, nil

	case int64:
		return float64(rawValue.(int64)), true, nil

	default:
		return 0.0, false, errors.New("Invalid value format")
	}

}

func query(db *core.DB, sql string, from int64, to int64) ([]timeseriesStruct, error) {
	rawRows, err := db.Query(sql, from, to)
	if err != nil {
		return nil, err
	}
	defer rawRows.Close()

	columnNames, err := rawRows.Columns()
	if err != nil {
		return nil, err
	}

	if len(columnNames) <= 1 {
		return nil, errors.New("The query only returned a single column.")
	}

	allTimeseries := make([]timeseriesStruct, len(columnNames)-1)
	for i, _ := range allTimeseries {
		allTimeseries[i].Name = columnNames[i+1]
		allTimeseries[i].Datapoints = make([]datapointStruct, 0)
	}

	var count = 0
	fields := make([]interface{}, len(columnNames))

	for rawRows.Next() {
		count += 1

		err = rawRows.ScanSlice(&fields)
		if err != nil {
			return nil, err
		}

		var timestamp time.Time
		timestamp, err = decodeTimestamp(fields[0])
		if err != nil {
			return nil, err
		}

		for i, _ := range allTimeseries {
			var value float64
			var isSet bool

			value, isSet, err = decodeValue(fields[i+1])
			if err != nil {
				return nil, err
			}

			if isSet {
				datapoint := datapointStruct{timestamp, value, false}
				allTimeseries[i].Datapoints = append(allTimeseries[i].Datapoints, datapoint)
			} else {
				datapoint := datapointStruct{timestamp, 0.0, true}
				allTimeseries[i].Datapoints = append(allTimeseries[i].Datapoints, datapoint)
			}
		}
	}

	log.Info("Found %d rows.", count)

	return allTimeseries, nil
}

type convertedTimeseriesStruct struct {
	Target     string        `json:"target"`
	Datapoints []interface{} `json:"datapoints"`
}

func HandleRequest(c *middleware.Context, ds *m.DataSource) {
	var req sqlDataRequest
	req.Body, _ = ioutil.ReadAll(c.Req.Request.Body)
	json.Unmarshal(req.Body, &req)

	log.Info("SQL request: query='%v', from=%v, to=%v", req.Query, req.From, req.To)

	engine, err := getEngine(ds)
	if err != nil {
		c.JsonApiErr(500, "Unable to open SQL connection", err)
		return
	}
	defer engine.Close()

	session := engine.NewSession()
	defer session.Close()

	db := session.DB()

	allTimeseries, err := query(db, req.Query, req.From, req.To)
	if err != nil {
		c.JsonApiErr(500, fmt.Sprintf("Data error: %v", err.Error()), err)
		return
	}

	// Convert the timeseries into the JSON form required by the Grafana frontend.
	convertedAllTimeseries := make([]convertedTimeseriesStruct, 0)
	for _, timeseries := range allTimeseries {
		convertedTimeseries := convertedTimeseriesStruct{}
		convertedTimeseries.Target = timeseries.Name
		convertedTimeseries.Datapoints = make([]interface{}, 0)
		for _, datapoint := range timeseries.Datapoints {
			timestamp := datapoint.Timestamp.UnixNano() / 1000.0 / 1000.0
			if datapoint.IsNull {
				convertedTimeseries.Datapoints = append(convertedTimeseries.Datapoints, []interface{}{nil, timestamp})
			} else {
				convertedTimeseries.Datapoints = append(convertedTimeseries.Datapoints, []interface{}{datapoint.Value, timestamp})
			}
		}

		convertedAllTimeseries = append(convertedAllTimeseries, convertedTimeseries)
	}

	c.JSON(200, convertedAllTimeseries)
}
