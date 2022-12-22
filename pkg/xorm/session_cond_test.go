// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"xorm.io/builder"
)

func TestBuilder(t *testing.T) {
	assert.NoError(t, prepareEngine())

	const (
		OpEqual int = iota
		OpGreatThan
		OpLessThan
	)

	type Condition struct {
		Id        int64
		TableName string
		ColName   string
		Op        int
		Value     string
	}

	err := testEngine.CreateTables(&Condition{})
	assert.NoError(t, err)

	_, err = testEngine.Insert(&Condition{TableName: "table1", ColName: "col1", Op: OpEqual, Value: "1"})
	assert.NoError(t, err)

	var cond Condition
	has, err := testEngine.Where(builder.Eq{"col_name": "col1"}).Get(&cond)
	assert.NoError(t, err)
	assert.Equal(t, true, has, "records should exist")

	has, err = testEngine.Where(builder.Eq{"col_name": "col1"}.
		And(builder.Eq{"op": OpEqual})).
		NoAutoCondition().
		Get(&cond)
	assert.NoError(t, err)
	assert.Equal(t, true, has, "records should exist")

	has, err = testEngine.Where(builder.Eq{"col_name": "col1", "op": OpEqual, "value": "1"}).
		NoAutoCondition().
		Get(&cond)
	assert.NoError(t, err)
	assert.Equal(t, true, has, "records should exist")

	has, err = testEngine.Where(builder.Eq{"col_name": "col1"}.
		And(builder.Neq{"op": OpEqual})).
		NoAutoCondition().
		Get(&cond)
	assert.NoError(t, err)
	assert.Equal(t, false, has, "records should not exist")

	var conds []Condition
	err = testEngine.Where(builder.Eq{"col_name": "col1"}.
		And(builder.Eq{"op": OpEqual})).
		Find(&conds)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, len(conds), "records should exist")

	conds = make([]Condition, 0)
	err = testEngine.Where(builder.Like{"col_name", "col"}).Find(&conds)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, len(conds), "records should exist")

	conds = make([]Condition, 0)
	err = testEngine.Where(builder.Expr("col_name = ?", "col1")).Find(&conds)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, len(conds), "records should exist")

	conds = make([]Condition, 0)
	err = testEngine.Where(builder.In("col_name", "col1", "col2")).Find(&conds)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, len(conds), "records should exist")

	conds = make([]Condition, 0)
	err = testEngine.NotIn("col_name", "col1", "col2").Find(&conds)
	assert.NoError(t, err)
	assert.EqualValues(t, 0, len(conds), "records should not exist")

	// complex condtions
	var where = builder.NewCond()
	if true {
		where = where.And(builder.Eq{"col_name": "col1"})
		where = where.Or(builder.And(builder.In("col_name", "col1", "col2"), builder.Expr("col_name = ?", "col1")))
	}

	conds = make([]Condition, 0)
	err = testEngine.Where(where).Find(&conds)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, len(conds), "records should exist")
}

func TestIn(t *testing.T) {
	assert.NoError(t, prepareEngine())
	assert.NoError(t, testEngine.Sync2(new(Userinfo)))

	cnt, err := testEngine.Insert([]Userinfo{
		{
			Username:   "user1",
			Departname: "dev",
		},
		{
			Username:   "user2",
			Departname: "dev",
		},
		{
			Username:   "user3",
			Departname: "dev",
		},
	})
	assert.NoError(t, err)
	assert.EqualValues(t, 3, cnt)

	department := "`" + testEngine.GetColumnMapper().Obj2Table("Departname") + "`"
	var usrs []Userinfo
	err = testEngine.Where(department+" = ?", "dev").Limit(3).Find(&usrs)
	assert.NoError(t, err)
	assert.EqualValues(t, 3, len(usrs))

	var ids []int64
	var idsStr string
	for _, u := range usrs {
		ids = append(ids, u.Uid)
		idsStr = fmt.Sprintf("%d,", u.Uid)
	}
	idsStr = idsStr[:len(idsStr)-1]

	users := make([]Userinfo, 0)
	err = testEngine.In("(id)", ids[0], ids[1], ids[2]).Find(&users)
	assert.NoError(t, err)
	fmt.Println(users)
	assert.EqualValues(t, 3, len(users))

	users = make([]Userinfo, 0)
	err = testEngine.In("(id)", ids).Find(&users)
	assert.NoError(t, err)
	fmt.Println(users)
	assert.EqualValues(t, 3, len(users))

	for _, user := range users {
		if user.Uid != ids[0] && user.Uid != ids[1] && user.Uid != ids[2] {
			err = errors.New("in uses should be " + idsStr + " total 3")
			assert.NoError(t, err)
		}
	}

	users = make([]Userinfo, 0)
	var idsInterface []interface{}
	for _, id := range ids {
		idsInterface = append(idsInterface, id)
	}

	err = testEngine.Where(department+" = ?", "dev").In("(id)", idsInterface...).Find(&users)
	assert.NoError(t, err)
	fmt.Println(users)
	assert.EqualValues(t, 3, len(users))

	for _, user := range users {
		if user.Uid != ids[0] && user.Uid != ids[1] && user.Uid != ids[2] {
			err = errors.New("in uses should be " + idsStr + " total 3")
			assert.NoError(t, err)
		}
	}

	dev := testEngine.GetColumnMapper().Obj2Table("Dev")

	err = testEngine.In("(id)", 1).In("(id)", 2).In(department, dev).Find(&users)
	assert.NoError(t, err)
	fmt.Println(users)

	cnt, err = testEngine.In("(id)", ids[0]).Update(&Userinfo{Departname: "dev-"})
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	user := new(Userinfo)
	has, err := testEngine.ID(ids[0]).Get(user)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, "dev-", user.Departname)

	cnt, err = testEngine.In("(id)", ids[0]).Update(&Userinfo{Departname: "dev"})
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	cnt, err = testEngine.In("(id)", ids[1]).Delete(&Userinfo{})
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)
}

func TestFindAndCount(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type FindAndCount struct {
		Id   int64
		Name string
	}

	assert.NoError(t, testEngine.Sync2(new(FindAndCount)))

	_, err := testEngine.Insert([]FindAndCount{
		{
			Name: "test1",
		},
		{
			Name: "test2",
		},
	})
	assert.NoError(t, err)

	var results []FindAndCount
	sess := testEngine.Where("name = ?", "test1")
	conds := sess.Conds()
	err = sess.Find(&results)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, len(results))

	total, err := testEngine.Where(conds).Count(new(FindAndCount))
	assert.NoError(t, err)
	assert.EqualValues(t, 1, total)
}
