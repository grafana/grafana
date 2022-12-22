// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"fmt"
	"strconv"
	"testing"
	"time"

	"xorm.io/builder"
	"xorm.io/core"

	"github.com/stretchr/testify/assert"
)

func TestQueryString(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type GetVar2 struct {
		Id      int64  `xorm:"autoincr pk"`
		Msg     string `xorm:"varchar(255)"`
		Age     int
		Money   float32
		Created time.Time `xorm:"created"`
	}

	assert.NoError(t, testEngine.Sync2(new(GetVar2)))

	var data = GetVar2{
		Msg:   "hi",
		Age:   28,
		Money: 1.5,
	}
	_, err := testEngine.InsertOne(data)
	assert.NoError(t, err)

	records, err := testEngine.QueryString("select * from " + testEngine.TableName("get_var2", true))
	assert.NoError(t, err)
	assert.Equal(t, 1, len(records))
	assert.Equal(t, 5, len(records[0]))
	assert.Equal(t, "1", records[0]["id"])
	assert.Equal(t, "hi", records[0]["msg"])
	assert.Equal(t, "28", records[0]["age"])
	assert.Equal(t, "1.5", records[0]["money"])
}

func TestQueryString2(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type GetVar3 struct {
		Id  int64 `xorm:"autoincr pk"`
		Msg bool  `xorm:"bit"`
	}

	assert.NoError(t, testEngine.Sync2(new(GetVar3)))

	var data = GetVar3{
		Msg: false,
	}
	_, err := testEngine.Insert(data)
	assert.NoError(t, err)

	records, err := testEngine.QueryString("select * from " + testEngine.TableName("get_var3", true))
	assert.NoError(t, err)
	assert.Equal(t, 1, len(records))
	assert.Equal(t, 2, len(records[0]))
	assert.Equal(t, "1", records[0]["id"])
	assert.True(t, "0" == records[0]["msg"] || "false" == records[0]["msg"])
}

func toString(i interface{}) string {
	switch i.(type) {
	case []byte:
		return string(i.([]byte))
	case string:
		return i.(string)
	}
	return fmt.Sprintf("%v", i)
}

func toInt64(i interface{}) int64 {
	switch i.(type) {
	case []byte:
		n, _ := strconv.ParseInt(string(i.([]byte)), 10, 64)
		return n
	case int:
		return int64(i.(int))
	case int64:
		return i.(int64)
	}
	return 0
}

func toFloat64(i interface{}) float64 {
	switch i.(type) {
	case []byte:
		n, _ := strconv.ParseFloat(string(i.([]byte)), 64)
		return n
	case float64:
		return i.(float64)
	case float32:
		return float64(i.(float32))
	}
	return 0
}

func TestQueryInterface(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type GetVarInterface struct {
		Id      int64  `xorm:"autoincr pk"`
		Msg     string `xorm:"varchar(255)"`
		Age     int
		Money   float32
		Created time.Time `xorm:"created"`
	}

	assert.NoError(t, testEngine.Sync2(new(GetVarInterface)))

	var data = GetVarInterface{
		Msg:   "hi",
		Age:   28,
		Money: 1.5,
	}
	_, err := testEngine.InsertOne(data)
	assert.NoError(t, err)

	records, err := testEngine.QueryInterface("select * from " + testEngine.TableName("get_var_interface", true))
	assert.NoError(t, err)
	assert.Equal(t, 1, len(records))
	assert.Equal(t, 5, len(records[0]))
	assert.EqualValues(t, 1, toInt64(records[0]["id"]))
	assert.Equal(t, "hi", toString(records[0]["msg"]))
	assert.EqualValues(t, 28, toInt64(records[0]["age"]))
	assert.EqualValues(t, 1.5, toFloat64(records[0]["money"]))
}

func TestQueryNoParams(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type QueryNoParams struct {
		Id      int64  `xorm:"autoincr pk"`
		Msg     string `xorm:"varchar(255)"`
		Age     int
		Money   float32
		Created time.Time `xorm:"created"`
	}

	testEngine.ShowSQL(true)

	assert.NoError(t, testEngine.Sync2(new(QueryNoParams)))

	var q = QueryNoParams{
		Msg:   "message",
		Age:   20,
		Money: 3000,
	}
	cnt, err := testEngine.Insert(&q)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	assertResult := func(t *testing.T, results []map[string][]byte) {
		assert.EqualValues(t, 1, len(results))
		id, err := strconv.ParseInt(string(results[0]["id"]), 10, 64)
		assert.NoError(t, err)
		assert.EqualValues(t, 1, id)
		assert.Equal(t, "message", string(results[0]["msg"]))

		age, err := strconv.Atoi(string(results[0]["age"]))
		assert.NoError(t, err)
		assert.EqualValues(t, 20, age)

		money, err := strconv.ParseFloat(string(results[0]["money"]), 32)
		assert.NoError(t, err)
		assert.EqualValues(t, 3000, money)
	}

	results, err := testEngine.Table("query_no_params").Limit(10).Query()
	assert.NoError(t, err)
	assertResult(t, results)

	results, err = testEngine.SQL("select * from " + testEngine.TableName("query_no_params", true)).Query()
	assert.NoError(t, err)
	assertResult(t, results)
}

func TestQueryStringNoParam(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type GetVar4 struct {
		Id  int64 `xorm:"autoincr pk"`
		Msg bool  `xorm:"bit"`
	}

	assert.NoError(t, testEngine.Sync2(new(GetVar4)))

	var data = GetVar4{
		Msg: false,
	}
	_, err := testEngine.Insert(data)
	assert.NoError(t, err)

	records, err := testEngine.Table("get_var4").Limit(1).QueryString()
	assert.NoError(t, err)
	assert.EqualValues(t, 1, len(records))
	assert.EqualValues(t, "1", records[0]["id"])
	if testEngine.Dialect().DBType() == core.POSTGRES || testEngine.Dialect().DBType() == core.MSSQL {
		assert.EqualValues(t, "false", records[0]["msg"])
	} else {
		assert.EqualValues(t, "0", records[0]["msg"])
	}

	records, err = testEngine.Table("get_var4").Where(builder.Eq{"id": 1}).QueryString()
	assert.NoError(t, err)
	assert.EqualValues(t, 1, len(records))
	assert.EqualValues(t, "1", records[0]["id"])
	if testEngine.Dialect().DBType() == core.POSTGRES || testEngine.Dialect().DBType() == core.MSSQL {
		assert.EqualValues(t, "false", records[0]["msg"])
	} else {
		assert.EqualValues(t, "0", records[0]["msg"])
	}
}

func TestQuerySliceStringNoParam(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type GetVar6 struct {
		Id  int64 `xorm:"autoincr pk"`
		Msg bool  `xorm:"bit"`
	}

	assert.NoError(t, testEngine.Sync2(new(GetVar6)))

	var data = GetVar6{
		Msg: false,
	}
	_, err := testEngine.Insert(data)
	assert.NoError(t, err)

	records, err := testEngine.Table("get_var6").Limit(1).QuerySliceString()
	assert.NoError(t, err)
	assert.EqualValues(t, 1, len(records))
	assert.EqualValues(t, "1", records[0][0])
	if testEngine.Dialect().DBType() == core.POSTGRES || testEngine.Dialect().DBType() == core.MSSQL {
		assert.EqualValues(t, "false", records[0][1])
	} else {
		assert.EqualValues(t, "0", records[0][1])
	}

	records, err = testEngine.Table("get_var6").Where(builder.Eq{"id": 1}).QuerySliceString()
	assert.NoError(t, err)
	assert.EqualValues(t, 1, len(records))
	assert.EqualValues(t, "1", records[0][0])
	if testEngine.Dialect().DBType() == core.POSTGRES || testEngine.Dialect().DBType() == core.MSSQL {
		assert.EqualValues(t, "false", records[0][1])
	} else {
		assert.EqualValues(t, "0", records[0][1])
	}
}

func TestQueryInterfaceNoParam(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type GetVar5 struct {
		Id  int64 `xorm:"autoincr pk"`
		Msg bool  `xorm:"bit"`
	}

	assert.NoError(t, testEngine.Sync2(new(GetVar5)))

	var data = GetVar5{
		Msg: false,
	}
	_, err := testEngine.Insert(data)
	assert.NoError(t, err)

	records, err := testEngine.Table("get_var5").Limit(1).QueryInterface()
	assert.NoError(t, err)
	assert.EqualValues(t, 1, len(records))
	assert.EqualValues(t, 1, toInt64(records[0]["id"]))
	assert.EqualValues(t, 0, toInt64(records[0]["msg"]))

	records, err = testEngine.Table("get_var5").Where(builder.Eq{"id": 1}).QueryInterface()
	assert.NoError(t, err)
	assert.EqualValues(t, 1, len(records))
	assert.EqualValues(t, 1, toInt64(records[0]["id"]))
	assert.EqualValues(t, 0, toInt64(records[0]["msg"]))
}

func TestQueryWithBuilder(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type QueryWithBuilder struct {
		Id      int64  `xorm:"autoincr pk"`
		Msg     string `xorm:"varchar(255)"`
		Age     int
		Money   float32
		Created time.Time `xorm:"created"`
	}

	testEngine.ShowSQL(true)

	assert.NoError(t, testEngine.Sync2(new(QueryWithBuilder)))

	var q = QueryWithBuilder{
		Msg:   "message",
		Age:   20,
		Money: 3000,
	}
	cnt, err := testEngine.Insert(&q)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	assertResult := func(t *testing.T, results []map[string][]byte) {
		assert.EqualValues(t, 1, len(results))
		id, err := strconv.ParseInt(string(results[0]["id"]), 10, 64)
		assert.NoError(t, err)
		assert.EqualValues(t, 1, id)
		assert.Equal(t, "message", string(results[0]["msg"]))

		age, err := strconv.Atoi(string(results[0]["age"]))
		assert.NoError(t, err)
		assert.EqualValues(t, 20, age)

		money, err := strconv.ParseFloat(string(results[0]["money"]), 32)
		assert.NoError(t, err)
		assert.EqualValues(t, 3000, money)
	}

	results, err := testEngine.Query(builder.Select("*").From(testEngine.TableName("query_with_builder", true)))
	assert.NoError(t, err)
	assertResult(t, results)
}

func TestJoinWithSubQuery(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type JoinWithSubQuery1 struct {
		Id       int64  `xorm:"autoincr pk"`
		Msg      string `xorm:"varchar(255)"`
		DepartId int64
		Money    float32
	}

	type JoinWithSubQueryDepart struct {
		Id   int64 `xorm:"autoincr pk"`
		Name string
	}

	testEngine.ShowSQL(true)

	assert.NoError(t, testEngine.Sync2(new(JoinWithSubQuery1), new(JoinWithSubQueryDepart)))

	var depart = JoinWithSubQueryDepart{
		Name: "depart1",
	}
	cnt, err := testEngine.Insert(&depart)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	var q = JoinWithSubQuery1{
		Msg:      "message",
		DepartId: depart.Id,
		Money:    3000,
	}

	cnt, err = testEngine.Insert(&q)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	tbName := testEngine.Quote(testEngine.TableName("join_with_sub_query_depart", true))
	var querys []JoinWithSubQuery1
	err = testEngine.Join("INNER", builder.Select("id").From(tbName),
		"join_with_sub_query_depart.id = join_with_sub_query1.depart_id").Find(&querys)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, len(querys))
	assert.EqualValues(t, q, querys[0])

	querys = make([]JoinWithSubQuery1, 0, 1)
	err = testEngine.Join("INNER", "(SELECT id FROM "+tbName+") join_with_sub_query_depart", "join_with_sub_query_depart.id = join_with_sub_query1.depart_id").
		Find(&querys)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, len(querys))
	assert.EqualValues(t, q, querys[0])
}
