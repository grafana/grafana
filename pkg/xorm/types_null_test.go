// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

type NullType struct {
	Id           int `xorm:"pk autoincr"`
	Name         sql.NullString
	Age          sql.NullInt64
	Height       sql.NullFloat64
	IsMan        sql.NullBool `xorm:"null"`
	CustomStruct CustomStruct `xorm:"valchar(64) null"`
}

type CustomStruct struct {
	Year  int
	Month int
	Day   int
}

func (CustomStruct) String() string {
	return "CustomStruct"
}

func (m *CustomStruct) Scan(value interface{}) error {
	if value == nil {
		m.Year, m.Month, m.Day = 0, 0, 0
		return nil
	}

	if s, ok := value.([]byte); ok {
		seps := strings.Split(string(s), "/")
		m.Year, _ = strconv.Atoi(seps[0])
		m.Month, _ = strconv.Atoi(seps[1])
		m.Day, _ = strconv.Atoi(seps[2])
		return nil
	}

	return errors.New("scan data not fit []byte")
}

func (m CustomStruct) Value() (driver.Value, error) {
	return fmt.Sprintf("%d/%d/%d", m.Year, m.Month, m.Day), nil
}

func TestCreateNullStructTable(t *testing.T) {
	assert.NoError(t, prepareEngine())

	err := testEngine.CreateTables(new(NullType))
	if err != nil {
		t.Error(err)
		panic(err)
	}
}

func TestDropNullStructTable(t *testing.T) {
	assert.NoError(t, prepareEngine())

	err := testEngine.DropTables(new(NullType))
	if err != nil {
		t.Error(err)
		panic(err)
	}
}

func TestNullStructInsert(t *testing.T) {
	assert.NoError(t, prepareEngine())
	assertSync(t, new(NullType))

	if true {
		item := new(NullType)
		_, err := testEngine.Insert(item)
		if err != nil {
			t.Error(err)
			panic(err)
		}
		fmt.Println(item)
		if item.Id != 1 {
			err = errors.New("insert error")
			t.Error(err)
			panic(err)
		}
	}

	if true {
		item := NullType{
			Name:   sql.NullString{String: "haolei", Valid: true},
			Age:    sql.NullInt64{Int64: 34, Valid: true},
			Height: sql.NullFloat64{Float64: 1.72, Valid: true},
			IsMan:  sql.NullBool{Bool: true, Valid: true},
		}
		_, err := testEngine.Insert(&item)
		if err != nil {
			t.Error(err)
			panic(err)
		}
		fmt.Println(item)
		if item.Id != 2 {
			err = errors.New("insert error")
			t.Error(err)
			panic(err)
		}
	}

	if true {
		items := []NullType{}

		for i := 0; i < 5; i++ {
			item := NullType{
				Name:         sql.NullString{String: "haolei_" + fmt.Sprint(i+1), Valid: true},
				Age:          sql.NullInt64{Int64: 30 + int64(i), Valid: true},
				Height:       sql.NullFloat64{Float64: 1.5 + 1.1*float64(i), Valid: true},
				IsMan:        sql.NullBool{Bool: true, Valid: true},
				CustomStruct: CustomStruct{i, i + 1, i + 2},
			}

			items = append(items, item)
		}

		_, err := testEngine.Insert(&items)
		if err != nil {
			t.Error(err)
			panic(err)
		}
		fmt.Println(items)
	}
}

func TestNullStructUpdate(t *testing.T) {
	assert.NoError(t, prepareEngine())
	assertSync(t, new(NullType))

	_, err := testEngine.Insert([]NullType{
		{
			Name: sql.NullString{
				String: "name1",
				Valid:  true,
			},
		},
		{
			Name: sql.NullString{
				String: "name2",
				Valid:  true,
			},
		},
		{
			Name: sql.NullString{
				String: "name3",
				Valid:  true,
			},
		},
		{
			Name: sql.NullString{
				String: "name4",
				Valid:  true,
			},
		},
	})
	assert.NoError(t, err)

	if true { // 测试可插入NULL
		item := new(NullType)
		item.Age = sql.NullInt64{Int64: 23, Valid: true}
		item.Height = sql.NullFloat64{Float64: 0, Valid: false} // update to NULL

		affected, err := testEngine.ID(2).Cols("age", "height", "is_man").Update(item)
		if err != nil {
			t.Error(err)
			panic(err)
		}
		if affected != 1 {
			err := errors.New("update failed")
			t.Error(err)
			panic(err)
		}
	}

	if true { // 测试In update
		item := new(NullType)
		item.Age = sql.NullInt64{Int64: 23, Valid: true}
		affected, err := testEngine.In("id", 3, 4).Cols("age", "height", "is_man").Update(item)
		if err != nil {
			t.Error(err)
			panic(err)
		}
		if affected != 2 {
			err := errors.New("update failed")
			t.Error(err)
			panic(err)
		}
	}

	if true { // 测试where
		item := new(NullType)
		item.Name = sql.NullString{String: "nullname", Valid: true}
		item.IsMan = sql.NullBool{Bool: true, Valid: true}
		item.Age = sql.NullInt64{Int64: 34, Valid: true}

		_, err := testEngine.Where("age > ?", 34).Update(item)
		if err != nil {
			t.Error(err)
			panic(err)
		}
	}

	if true { // 修改全部时，插入空值
		item := &NullType{
			Name:   sql.NullString{String: "winxxp", Valid: true},
			Age:    sql.NullInt64{Int64: 30, Valid: true},
			Height: sql.NullFloat64{Float64: 1.72, Valid: true},
			// IsMan:  sql.NullBool{true, true},
		}

		_, err := testEngine.AllCols().ID(6).Update(item)
		if err != nil {
			t.Error(err)
			panic(err)
		}
		fmt.Println(item)
	}

}

func TestNullStructFind(t *testing.T) {
	assert.NoError(t, prepareEngine())
	assertSync(t, new(NullType))

	_, err := testEngine.Insert([]NullType{
		{
			Name: sql.NullString{
				String: "name1",
				Valid:  false,
			},
		},
		{
			Name: sql.NullString{
				String: "name2",
				Valid:  true,
			},
		},
		{
			Name: sql.NullString{
				String: "name3",
				Valid:  true,
			},
		},
		{
			Name: sql.NullString{
				String: "name4",
				Valid:  true,
			},
		},
	})
	assert.NoError(t, err)

	if true {
		item := new(NullType)
		has, err := testEngine.ID(1).Get(item)
		if err != nil {
			t.Error(err)
			panic(err)
		}
		if !has {
			t.Error(errors.New("no find id 1"))
			panic(err)
		}
		fmt.Println(item)
		if item.Id != 1 || item.Name.Valid || item.Age.Valid || item.Height.Valid ||
			item.IsMan.Valid {
			err = errors.New("insert error")
			t.Error(err)
			panic(err)
		}
	}

	if true {
		item := new(NullType)
		item.Id = 2

		has, err := testEngine.Get(item)
		if err != nil {
			t.Error(err)
			panic(err)
		}
		if !has {
			t.Error(errors.New("no find id 2"))
			panic(err)
		}
		fmt.Println(item)
	}

	if true {
		item := make([]NullType, 0)

		err := testEngine.ID(2).Find(&item)
		if err != nil {
			t.Error(err)
			panic(err)
		}

		fmt.Println(item)
	}

	if true {
		item := make([]NullType, 0)

		err := testEngine.Asc("age").Find(&item)
		if err != nil {
			t.Error(err)
			panic(err)
		}

		for k, v := range item {
			fmt.Println(k, v)
		}
	}
}

func TestNullStructIterate(t *testing.T) {
	assert.NoError(t, prepareEngine())
	assertSync(t, new(NullType))

	if true {
		err := testEngine.Where("age IS NOT NULL").OrderBy("age").Iterate(new(NullType),
			func(i int, bean interface{}) error {
				nultype := bean.(*NullType)
				fmt.Println(i, nultype)
				return nil
			})
		if err != nil {
			t.Error(err)
			panic(err)
		}
	}
}

func TestNullStructCount(t *testing.T) {
	assert.NoError(t, prepareEngine())
	assertSync(t, new(NullType))

	if true {
		item := new(NullType)
		total, err := testEngine.Where("age IS NOT NULL").Count(item)
		if err != nil {
			t.Error(err)
			panic(err)
		}
		fmt.Println(total)
	}
}

func TestNullStructRows(t *testing.T) {
	assert.NoError(t, prepareEngine())
	assertSync(t, new(NullType))

	item := new(NullType)
	rows, err := testEngine.Where("id > ?", 1).Rows(item)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	defer rows.Close()

	for rows.Next() {
		err = rows.Scan(item)
		if err != nil {
			t.Error(err)
			panic(err)
		}
		fmt.Println(item)
	}
}

func TestNullStructDelete(t *testing.T) {
	assert.NoError(t, prepareEngine())
	assertSync(t, new(NullType))

	item := new(NullType)

	_, err := testEngine.ID(1).Delete(item)
	if err != nil {
		t.Error(err)
		panic(err)
	}

	_, err = testEngine.Where("id > ?", 1).Delete(item)
	if err != nil {
		t.Error(err)
		panic(err)
	}
}
