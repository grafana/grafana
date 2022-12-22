// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"fmt"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"xorm.io/builder"
)

func isFloatEq(i, j float64, precision int) bool {
	return fmt.Sprintf("%."+strconv.Itoa(precision)+"f", i) == fmt.Sprintf("%."+strconv.Itoa(precision)+"f", j)
}

func TestSum(t *testing.T) {
	type SumStruct struct {
		Int   int
		Float float32
	}

	assert.NoError(t, prepareEngine())
	assert.NoError(t, testEngine.Sync2(new(SumStruct)))

	var (
		cases = []SumStruct{
			{1, 6.2},
			{2, 5.3},
			{92, -0.2},
		}
	)

	var i int
	var f float32
	for _, v := range cases {
		i += v.Int
		f += v.Float
	}

	cnt, err := testEngine.Insert(cases)
	assert.NoError(t, err)
	assert.EqualValues(t, 3, cnt)

	colInt := testEngine.GetColumnMapper().Obj2Table("Int")
	colFloat := testEngine.GetColumnMapper().Obj2Table("Float")

	sumInt, err := testEngine.Sum(new(SumStruct), colInt)
	assert.NoError(t, err)
	assert.EqualValues(t, int(sumInt), i)

	sumFloat, err := testEngine.Sum(new(SumStruct), colFloat)
	assert.NoError(t, err)
	assert.Condition(t, func() bool {
		return isFloatEq(sumFloat, float64(f), 2)
	})

	sums, err := testEngine.Sums(new(SumStruct), colInt, colFloat)
	assert.NoError(t, err)
	assert.EqualValues(t, 2, len(sums))
	assert.EqualValues(t, i, int(sums[0]))
	assert.Condition(t, func() bool {
		return isFloatEq(sums[1], float64(f), 2)
	})

	sumsInt, err := testEngine.SumsInt(new(SumStruct), colInt)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, len(sumsInt))
	assert.EqualValues(t, i, int(sumsInt[0]))
}

type SumStructWithTableName struct {
	Int   int
	Float float32
}

func (s SumStructWithTableName) TableName() string {
	return "sum_struct_with_table_name_1"
}

func TestSumWithTableName(t *testing.T) {
	assert.NoError(t, prepareEngine())
	assert.NoError(t, testEngine.Sync2(new(SumStructWithTableName)))

	var (
		cases = []SumStructWithTableName{
			{1, 6.2},
			{2, 5.3},
			{92, -0.2},
		}
	)

	var i int
	var f float32
	for _, v := range cases {
		i += v.Int
		f += v.Float
	}

	cnt, err := testEngine.Insert(cases)
	assert.NoError(t, err)
	assert.EqualValues(t, 3, cnt)

	colInt := testEngine.GetColumnMapper().Obj2Table("Int")
	colFloat := testEngine.GetColumnMapper().Obj2Table("Float")

	sumInt, err := testEngine.Sum(new(SumStructWithTableName), colInt)
	assert.NoError(t, err)
	assert.EqualValues(t, int(sumInt), i)

	sumFloat, err := testEngine.Sum(new(SumStructWithTableName), colFloat)
	assert.NoError(t, err)
	assert.Condition(t, func() bool {
		return isFloatEq(sumFloat, float64(f), 2)
	})

	sums, err := testEngine.Sums(new(SumStructWithTableName), colInt, colFloat)
	assert.NoError(t, err)
	assert.EqualValues(t, 2, len(sums))
	assert.EqualValues(t, i, int(sums[0]))
	assert.Condition(t, func() bool {
		return isFloatEq(sums[1], float64(f), 2)
	})

	sumsInt, err := testEngine.SumsInt(new(SumStructWithTableName), colInt)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, len(sumsInt))
	assert.EqualValues(t, i, int(sumsInt[0]))
}

func TestSumCustomColumn(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type SumStruct2 struct {
		Int   int
		Float float32
	}

	var (
		cases = []SumStruct2{
			{1, 6.2},
			{2, 5.3},
			{92, -0.2},
		}
	)

	assert.NoError(t, testEngine.Sync2(new(SumStruct2)))

	cnt, err := testEngine.Insert(cases)
	assert.NoError(t, err)
	assert.EqualValues(t, 3, cnt)

	sumInt, err := testEngine.Sum(new(SumStruct2),
		"CASE WHEN `int` <= 2 THEN `int` ELSE 0 END")
	assert.NoError(t, err)
	assert.EqualValues(t, 3, int(sumInt))
}

func TestCount(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type UserinfoCount struct {
		Departname string
	}
	assert.NoError(t, testEngine.Sync2(new(UserinfoCount)))

	colName := testEngine.GetColumnMapper().Obj2Table("Departname")
	var cond builder.Cond = builder.Eq{
		"`" + colName + "`": "dev",
	}

	total, err := testEngine.Where(cond).Count(new(UserinfoCount))
	assert.NoError(t, err)
	assert.EqualValues(t, 0, total)

	cnt, err := testEngine.Insert(&UserinfoCount{
		Departname: "dev",
	})
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	total, err = testEngine.Where(cond).Count(new(UserinfoCount))
	assert.NoError(t, err)
	assert.EqualValues(t, 1, total)

	total, err = testEngine.Where(cond).Table("userinfo_count").Count()
	assert.NoError(t, err)
	assert.EqualValues(t, 1, total)

	total, err = testEngine.Table("userinfo_count").Count()
	assert.NoError(t, err)
	assert.EqualValues(t, 1, total)
}

func TestSQLCount(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type UserinfoCount2 struct {
		Id         int64
		Departname string
	}

	type UserinfoBooks struct {
		Id     int64
		Pid    int64
		IsOpen bool
	}

	assertSync(t, new(UserinfoCount2), new(UserinfoBooks))

	total, err := testEngine.SQL("SELECT count(id) FROM " + testEngine.TableName("userinfo_count2", true)).
		Count()
	assert.NoError(t, err)
	assert.EqualValues(t, 0, total)
}

func TestCountWithOthers(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type CountWithOthers struct {
		Id   int64
		Name string
	}

	assertSync(t, new(CountWithOthers))

	_, err := testEngine.Insert(&CountWithOthers{
		Name: "orderby",
	})
	assert.NoError(t, err)

	_, err = testEngine.Insert(&CountWithOthers{
		Name: "limit",
	})
	assert.NoError(t, err)

	total, err := testEngine.OrderBy("id desc").Limit(1).Count(new(CountWithOthers))
	assert.NoError(t, err)
	assert.EqualValues(t, 2, total)
}

type CountWithTableName struct {
	Id   int64
	Name string
}

func (CountWithTableName) TableName() string {
	return "count_with_table_name1"
}

func TestWithTableName(t *testing.T) {
	assert.NoError(t, prepareEngine())

	assertSync(t, new(CountWithTableName))

	_, err := testEngine.Insert(&CountWithTableName{
		Name: "orderby",
	})
	assert.NoError(t, err)

	_, err = testEngine.Insert(CountWithTableName{
		Name: "limit",
	})
	assert.NoError(t, err)

	total, err := testEngine.OrderBy("id desc").Count(new(CountWithTableName))
	assert.NoError(t, err)
	assert.EqualValues(t, 2, total)

	total, err = testEngine.OrderBy("id desc").Count(CountWithTableName{})
	assert.NoError(t, err)
	assert.EqualValues(t, 2, total)
}
