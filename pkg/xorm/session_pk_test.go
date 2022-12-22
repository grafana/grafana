// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"errors"
	"sort"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"xorm.io/core"
)

type IntId struct {
	Id   int `xorm:"pk autoincr"`
	Name string
}

type Int16Id struct {
	Id   int16 `xorm:"pk autoincr"`
	Name string
}

type Int32Id struct {
	Id   int32 `xorm:"pk autoincr"`
	Name string
}

type UintId struct {
	Id   uint `xorm:"pk autoincr"`
	Name string
}

type Uint16Id struct {
	Id   uint16 `xorm:"pk autoincr"`
	Name string
}

type Uint32Id struct {
	Id   uint32 `xorm:"pk autoincr"`
	Name string
}

type Uint64Id struct {
	Id   uint64 `xorm:"pk autoincr"`
	Name string
}

type StringPK struct {
	Id   string `xorm:"pk notnull"`
	Name string
}

type ID int64
type MyIntPK struct {
	ID   ID `xorm:"pk autoincr"`
	Name string
}

type StrID string
type MyStringPK struct {
	ID   StrID `xorm:"pk notnull"`
	Name string
}

func TestIntId(t *testing.T) {
	assert.NoError(t, prepareEngine())

	err := testEngine.DropTables(&IntId{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	err = testEngine.CreateTables(&IntId{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	cnt, err := testEngine.Insert(&IntId{Name: "test"})
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if cnt != 1 {
		err = errors.New("insert count should be one")
		t.Error(err)
		panic(err)
	}

	bean := new(IntId)
	has, err := testEngine.Get(bean)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if !has {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	beans := make([]IntId, 0)
	err = testEngine.Find(&beans)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if len(beans) != 1 {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	beans2 := make(map[int]IntId)
	err = testEngine.Find(&beans2)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if len(beans2) != 1 {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	cnt, err = testEngine.ID(bean.Id).Delete(&IntId{})
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if cnt != 1 {
		err = errors.New("insert count should be one")
		t.Error(err)
		panic(err)
	}
}

func TestInt16Id(t *testing.T) {
	assert.NoError(t, prepareEngine())

	err := testEngine.DropTables(&Int16Id{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	err = testEngine.CreateTables(&Int16Id{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	cnt, err := testEngine.Insert(&Int16Id{Name: "test"})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	if cnt != 1 {
		err = errors.New("insert count should be one")
		t.Error(err)
		panic(err)
	}

	bean := new(Int16Id)
	has, err := testEngine.Get(bean)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if !has {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	beans := make([]Int16Id, 0)
	err = testEngine.Find(&beans)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if len(beans) != 1 {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	beans2 := make(map[int16]Int16Id, 0)
	err = testEngine.Find(&beans2)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if len(beans2) != 1 {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	cnt, err = testEngine.ID(bean.Id).Delete(&Int16Id{})
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if cnt != 1 {
		err = errors.New("insert count should be one")
		t.Error(err)
		panic(err)
	}
}

func TestInt32Id(t *testing.T) {
	assert.NoError(t, prepareEngine())

	err := testEngine.DropTables(&Int32Id{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	err = testEngine.CreateTables(&Int32Id{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	cnt, err := testEngine.Insert(&Int32Id{Name: "test"})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	if cnt != 1 {
		err = errors.New("insert count should be one")
		t.Error(err)
		panic(err)
	}

	bean := new(Int32Id)
	has, err := testEngine.Get(bean)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if !has {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	beans := make([]Int32Id, 0)
	err = testEngine.Find(&beans)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if len(beans) != 1 {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	beans2 := make(map[int32]Int32Id, 0)
	err = testEngine.Find(&beans2)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if len(beans2) != 1 {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	cnt, err = testEngine.ID(bean.Id).Delete(&Int32Id{})
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if cnt != 1 {
		err = errors.New("insert count should be one")
		t.Error(err)
		panic(err)
	}
}

func TestUintId(t *testing.T) {
	assert.NoError(t, prepareEngine())

	err := testEngine.DropTables(&UintId{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	err = testEngine.CreateTables(&UintId{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	cnt, err := testEngine.Insert(&UintId{Name: "test"})
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if cnt != 1 {
		err = errors.New("insert count should be one")
		t.Error(err)
		panic(err)
	}

	var inserts = []UintId{
		{Name: "test1"},
		{Name: "test2"},
	}
	cnt, err = testEngine.Insert(&inserts)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if cnt != 2 {
		err = errors.New("insert count should be two")
		t.Error(err)
		panic(err)
	}

	bean := new(UintId)
	has, err := testEngine.Get(bean)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if !has {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	beans := make([]UintId, 0)
	err = testEngine.Find(&beans)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if len(beans) != 3 {
		err = errors.New("get count should be three")
		t.Error(err)
		panic(err)
	}

	beans2 := make(map[uint]UintId, 0)
	err = testEngine.Find(&beans2)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if len(beans2) != 3 {
		err = errors.New("get count should be three")
		t.Error(err)
		panic(err)
	}

	cnt, err = testEngine.ID(bean.Id).Delete(&UintId{})
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if cnt != 1 {
		err = errors.New("insert count should be one")
		t.Error(err)
		panic(err)
	}
}

func TestUint16Id(t *testing.T) {
	assert.NoError(t, prepareEngine())

	err := testEngine.DropTables(&Uint16Id{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	err = testEngine.CreateTables(&Uint16Id{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	cnt, err := testEngine.Insert(&Uint16Id{Name: "test"})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	if cnt != 1 {
		err = errors.New("insert count should be one")
		t.Error(err)
		panic(err)
	}

	bean := new(Uint16Id)
	has, err := testEngine.Get(bean)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if !has {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	beans := make([]Uint16Id, 0)
	err = testEngine.Find(&beans)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if len(beans) != 1 {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	beans2 := make(map[uint16]Uint16Id, 0)
	err = testEngine.Find(&beans2)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if len(beans2) != 1 {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	cnt, err = testEngine.ID(bean.Id).Delete(&Uint16Id{})
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if cnt != 1 {
		err = errors.New("insert count should be one")
		t.Error(err)
		panic(err)
	}
}

func TestUint32Id(t *testing.T) {
	assert.NoError(t, prepareEngine())

	err := testEngine.DropTables(&Uint32Id{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	err = testEngine.CreateTables(&Uint32Id{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	cnt, err := testEngine.Insert(&Uint32Id{Name: "test"})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	if cnt != 1 {
		err = errors.New("insert count should be one")
		t.Error(err)
		panic(err)
	}

	bean := new(Uint32Id)
	has, err := testEngine.Get(bean)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if !has {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	beans := make([]Uint32Id, 0)
	err = testEngine.Find(&beans)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if len(beans) != 1 {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	beans2 := make(map[uint32]Uint32Id, 0)
	err = testEngine.Find(&beans2)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if len(beans2) != 1 {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	cnt, err = testEngine.ID(bean.Id).Delete(&Uint32Id{})
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if cnt != 1 {
		err = errors.New("insert count should be one")
		t.Error(err)
		panic(err)
	}
}

func TestUint64Id(t *testing.T) {
	assert.NoError(t, prepareEngine())

	err := testEngine.DropTables(&Uint64Id{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	err = testEngine.CreateTables(&Uint64Id{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	idbean := &Uint64Id{Name: "test"}
	cnt, err := testEngine.Insert(idbean)
	if err != nil {
		t.Error(err)
		panic(err)
	}

	if cnt != 1 {
		err = errors.New("insert count should be one")
		t.Error(err)
		panic(err)
	}

	bean := new(Uint64Id)
	has, err := testEngine.Get(bean)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if !has {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	if bean.Id != idbean.Id {
		panic(errors.New("should be equal"))
	}

	beans := make([]Uint64Id, 0)
	err = testEngine.Find(&beans)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if len(beans) != 1 {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	if *bean != beans[0] {
		panic(errors.New("should be equal"))
	}

	beans2 := make(map[uint64]Uint64Id, 0)
	err = testEngine.Find(&beans2)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if len(beans2) != 1 {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	if *bean != beans2[bean.Id] {
		panic(errors.New("should be equal"))
	}

	cnt, err = testEngine.ID(bean.Id).Delete(&Uint64Id{})
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if cnt != 1 {
		err = errors.New("insert count should be one")
		t.Error(err)
		panic(err)
	}
}

func TestStringPK(t *testing.T) {
	assert.NoError(t, prepareEngine())

	err := testEngine.DropTables(&StringPK{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	err = testEngine.CreateTables(&StringPK{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	cnt, err := testEngine.Insert(&StringPK{Id: "1-1-2", Name: "test"})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	if cnt != 1 {
		err = errors.New("insert count should be one")
		t.Error(err)
		panic(err)
	}

	bean := new(StringPK)
	has, err := testEngine.Get(bean)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if !has {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	beans := make([]StringPK, 0)
	err = testEngine.Find(&beans)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if len(beans) != 1 {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	beans2 := make(map[string]StringPK)
	err = testEngine.Find(&beans2)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if len(beans2) != 1 {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	cnt, err = testEngine.ID(bean.Id).Delete(&StringPK{})
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if cnt != 1 {
		err = errors.New("insert count should be one")
		t.Error(err)
		panic(err)
	}
}

type CompositeKey struct {
	Id1       int64 `xorm:"id1 pk"`
	Id2       int64 `xorm:"id2 pk"`
	UpdateStr string
}

func TestCompositeKey(t *testing.T) {
	assert.NoError(t, prepareEngine())

	err := testEngine.DropTables(&CompositeKey{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	err = testEngine.CreateTables(&CompositeKey{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	cnt, err := testEngine.Insert(&CompositeKey{11, 22, ""})
	if err != nil {
		t.Error(err)
	} else if cnt != 1 {
		t.Error(errors.New("failed to insert CompositeKey{11, 22}"))
	}

	cnt, err = testEngine.Insert(&CompositeKey{11, 22, ""})
	if err == nil || cnt == 1 {
		t.Error(errors.New("inserted CompositeKey{11, 22}"))
	}

	var compositeKeyVal CompositeKey
	has, err := testEngine.ID(core.PK{11, 22}).Get(&compositeKeyVal)
	if err != nil {
		t.Error(err)
	} else if !has {
		t.Error(errors.New("can't get CompositeKey{11, 22}"))
	}

	var compositeKeyVal2 CompositeKey
	// test passing PK ptr, this test seem failed withCache
	has, err = testEngine.ID(&core.PK{11, 22}).Get(&compositeKeyVal2)
	if err != nil {
		t.Error(err)
	} else if !has {
		t.Error(errors.New("can't get CompositeKey{11, 22}"))
	}

	if compositeKeyVal != compositeKeyVal2 {
		t.Error(errors.New("should be equal"))
	}

	var cps = make([]CompositeKey, 0)
	err = testEngine.Find(&cps)
	if err != nil {
		t.Error(err)
	}
	if len(cps) != 1 {
		t.Error(errors.New("should has one record"))
	}
	if cps[0] != compositeKeyVal {
		t.Error(errors.New("should be equal"))
	}

	cnt, err = testEngine.Insert(&CompositeKey{22, 22, ""})
	if err != nil {
		t.Error(err)
	} else if cnt != 1 {
		t.Error(errors.New("failed to insert CompositeKey{22, 22}"))
	}

	cps = make([]CompositeKey, 0)
	err = testEngine.Find(&cps)
	assert.NoError(t, err)
	assert.EqualValues(t, 2, len(cps), "should has two record")
	assert.EqualValues(t, compositeKeyVal, cps[0], "should be equeal")

	compositeKeyVal = CompositeKey{UpdateStr: "test1"}
	cnt, err = testEngine.ID(core.PK{11, 22}).Update(&compositeKeyVal)
	if err != nil {
		t.Error(err)
	} else if cnt != 1 {
		t.Error(errors.New("can't update CompositeKey{11, 22}"))
	}

	cnt, err = testEngine.ID(core.PK{11, 22}).Delete(&CompositeKey{})
	if err != nil {
		t.Error(err)
	} else if cnt != 1 {
		t.Error(errors.New("can't delete CompositeKey{11, 22}"))
	}
}

func TestCompositeKey2(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type User struct {
		UserId   string `xorm:"varchar(19) not null pk"`
		NickName string `xorm:"varchar(19) not null"`
		GameId   uint32 `xorm:"integer pk"`
		Score    int32  `xorm:"integer"`
	}

	err := testEngine.DropTables(&User{})

	if err != nil {
		t.Error(err)
		panic(err)
	}

	err = testEngine.CreateTables(&User{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	cnt, err := testEngine.Insert(&User{"11", "nick", 22, 5})
	if err != nil {
		t.Error(err)
	} else if cnt != 1 {
		t.Error(errors.New("failed to insert User{11, 22}"))
	}

	cnt, err = testEngine.Insert(&User{"11", "nick", 22, 6})
	if err == nil || cnt == 1 {
		t.Error(errors.New("inserted User{11, 22}"))
	}

	var user User
	has, err := testEngine.ID(core.PK{"11", 22}).Get(&user)
	if err != nil {
		t.Error(err)
	} else if !has {
		t.Error(errors.New("can't get User{11, 22}"))
	}

	// test passing PK ptr, this test seem failed withCache
	has, err = testEngine.ID(&core.PK{"11", 22}).Get(&user)
	if err != nil {
		t.Error(err)
	} else if !has {
		t.Error(errors.New("can't get User{11, 22}"))
	}

	user = User{NickName: "test1"}
	cnt, err = testEngine.ID(core.PK{"11", 22}).Update(&user)
	if err != nil {
		t.Error(err)
	} else if cnt != 1 {
		t.Error(errors.New("can't update User{11, 22}"))
	}

	cnt, err = testEngine.ID(core.PK{"11", 22}).Delete(&User{})
	if err != nil {
		t.Error(err)
	} else if cnt != 1 {
		t.Error(errors.New("can't delete CompositeKey{11, 22}"))
	}
}

type MyString string
type UserPK2 struct {
	UserId   MyString `xorm:"varchar(19) not null pk"`
	NickName string   `xorm:"varchar(19) not null"`
	GameId   uint32   `xorm:"integer pk"`
	Score    int32    `xorm:"integer"`
}

func TestCompositeKey3(t *testing.T) {
	assert.NoError(t, prepareEngine())

	err := testEngine.DropTables(&UserPK2{})

	if err != nil {
		t.Error(err)
		panic(err)
	}

	err = testEngine.CreateTables(&UserPK2{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	cnt, err := testEngine.Insert(&UserPK2{"11", "nick", 22, 5})
	if err != nil {
		t.Error(err)
	} else if cnt != 1 {
		t.Error(errors.New("failed to insert User{11, 22}"))
	}

	cnt, err = testEngine.Insert(&UserPK2{"11", "nick", 22, 6})
	if err == nil || cnt == 1 {
		t.Error(errors.New("inserted User{11, 22}"))
	}

	var user UserPK2
	has, err := testEngine.ID(core.PK{"11", 22}).Get(&user)
	if err != nil {
		t.Error(err)
	} else if !has {
		t.Error(errors.New("can't get User{11, 22}"))
	}

	// test passing PK ptr, this test seem failed withCache
	has, err = testEngine.ID(&core.PK{"11", 22}).Get(&user)
	if err != nil {
		t.Error(err)
	} else if !has {
		t.Error(errors.New("can't get User{11, 22}"))
	}

	user = UserPK2{NickName: "test1"}
	cnt, err = testEngine.ID(core.PK{"11", 22}).Update(&user)
	if err != nil {
		t.Error(err)
	} else if cnt != 1 {
		t.Error(errors.New("can't update User{11, 22}"))
	}

	cnt, err = testEngine.ID(core.PK{"11", 22}).Delete(&UserPK2{})
	if err != nil {
		t.Error(err)
	} else if cnt != 1 {
		t.Error(errors.New("can't delete CompositeKey{11, 22}"))
	}
}

func TestMyIntId(t *testing.T) {
	assert.NoError(t, prepareEngine())

	err := testEngine.DropTables(&MyIntPK{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	err = testEngine.CreateTables(&MyIntPK{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	idbean := &MyIntPK{Name: "test"}
	cnt, err := testEngine.Insert(idbean)
	if err != nil {
		t.Error(err)
		panic(err)
	}

	if cnt != 1 {
		err = errors.New("insert count should be one")
		t.Error(err)
		panic(err)
	}

	bean := new(MyIntPK)
	has, err := testEngine.Get(bean)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if !has {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	if bean.ID != idbean.ID {
		panic(errors.New("should be equal"))
	}

	var beans []MyIntPK
	err = testEngine.Find(&beans)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if len(beans) != 1 {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	if *bean != beans[0] {
		panic(errors.New("should be equal"))
	}

	beans2 := make(map[ID]MyIntPK, 0)
	err = testEngine.Find(&beans2)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if len(beans2) != 1 {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	if *bean != beans2[bean.ID] {
		panic(errors.New("should be equal"))
	}

	cnt, err = testEngine.ID(bean.ID).Delete(&MyIntPK{})
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if cnt != 1 {
		err = errors.New("insert count should be one")
		t.Error(err)
		panic(err)
	}
}

func TestMyStringId(t *testing.T) {
	assert.NoError(t, prepareEngine())

	err := testEngine.DropTables(&MyStringPK{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	err = testEngine.CreateTables(&MyStringPK{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	idbean := &MyStringPK{ID: "1111", Name: "test"}
	cnt, err := testEngine.Insert(idbean)
	if err != nil {
		t.Error(err)
		panic(err)
	}

	if cnt != 1 {
		err = errors.New("insert count should be one")
		t.Error(err)
		panic(err)
	}

	bean := new(MyStringPK)
	has, err := testEngine.Get(bean)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if !has {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	if bean.ID != idbean.ID {
		panic(errors.New("should be equal"))
	}

	var beans []MyStringPK
	err = testEngine.Find(&beans)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if len(beans) != 1 {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	if *bean != beans[0] {
		panic(errors.New("should be equal"))
	}

	beans2 := make(map[StrID]MyStringPK, 0)
	err = testEngine.Find(&beans2)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if len(beans2) != 1 {
		err = errors.New("get count should be one")
		t.Error(err)
		panic(err)
	}

	if *bean != beans2[bean.ID] {
		panic(errors.New("should be equal"))
	}

	cnt, err = testEngine.ID(bean.ID).Delete(&MyStringPK{})
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if cnt != 1 {
		err = errors.New("insert count should be one")
		t.Error(err)
		panic(err)
	}
}

func TestSingleAutoIncrColumn(t *testing.T) {
	type Account struct {
		Id int64 `xorm:"pk autoincr"`
	}

	assert.NoError(t, prepareEngine())
	assertSync(t, new(Account))

	_, err := testEngine.Insert(&Account{})
	assert.NoError(t, err)
}

func TestCompositePK(t *testing.T) {
	type TaskSolution struct {
		UID     string    `xorm:"notnull pk UUID 'uid'"`
		TID     string    `xorm:"notnull pk UUID 'tid'"`
		Created time.Time `xorm:"created"`
		Updated time.Time `xorm:"updated"`
	}

	assert.NoError(t, prepareEngine())

	tables1, err := testEngine.DBMetas()
	assert.NoError(t, err)

	assertSync(t, new(TaskSolution))
	assert.NoError(t, testEngine.Sync2(new(TaskSolution)))

	tables2, err := testEngine.DBMetas()
	assert.NoError(t, err)
	assert.EqualValues(t, 1+len(tables1), len(tables2))

	var table *core.Table
	for _, t := range tables2 {
		if t.Name == testEngine.GetTableMapper().Obj2Table("TaskSolution") {
			table = t
			break
		}
	}

	assert.NotEqual(t, nil, table)

	pkCols := table.PKColumns()
	assert.EqualValues(t, 2, len(pkCols))

	names := []string{pkCols[0].Name, pkCols[1].Name}
	sort.Strings(names)
	assert.EqualValues(t, []string{"tid", "uid"}, names)
}

func TestNoPKIdQueryUpdate(t *testing.T) {
	type NoPKTable struct {
		Username string
	}

	assert.NoError(t, prepareEngine())
	assertSync(t, new(NoPKTable))

	cnt, err := testEngine.Insert(&NoPKTable{
		Username: "test",
	})
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	var res NoPKTable
	has, err := testEngine.ID("test").Get(&res)
	assert.Error(t, err)
	assert.False(t, has)

	cnt, err = testEngine.ID("test").Update(&NoPKTable{
		Username: "test1",
	})
	assert.Error(t, err)
	assert.EqualValues(t, 0, cnt)

	type UnvalidPKTable struct {
		ID       int `xorm:"id"`
		Username string
	}

	assertSync(t, new(UnvalidPKTable))

	cnt, err = testEngine.Insert(&UnvalidPKTable{
		ID:       1,
		Username: "test",
	})
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	var res2 UnvalidPKTable
	has, err = testEngine.ID(1).Get(&res2)
	assert.Error(t, err)
	assert.False(t, has)

	cnt, err = testEngine.ID(1).Update(&UnvalidPKTable{
		Username: "test1",
	})
	assert.Error(t, err)
	assert.EqualValues(t, 0, cnt)
}
