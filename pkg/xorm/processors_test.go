// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestBefore_Get(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type BeforeTable struct {
		Id   int64
		Name string
		Val  string `xorm:"-"`
	}

	assert.NoError(t, testEngine.Sync2(new(BeforeTable)))

	cnt, err := testEngine.Insert(&BeforeTable{
		Name: "test",
	})
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	var be BeforeTable
	has, err := testEngine.Before(func(bean interface{}) {
		bean.(*BeforeTable).Val = "val"
	}).Get(&be)
	assert.NoError(t, err)
	assert.Equal(t, true, has)
	assert.Equal(t, "val", be.Val)
	assert.Equal(t, "test", be.Name)
}

func TestBefore_Find(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type BeforeTable2 struct {
		Id   int64
		Name string
		Val  string `xorm:"-"`
	}

	assert.NoError(t, testEngine.Sync2(new(BeforeTable2)))

	cnt, err := testEngine.Insert([]BeforeTable2{
		{Name: "test1"},
		{Name: "test2"},
	})
	assert.NoError(t, err)
	assert.EqualValues(t, 2, cnt)

	var be []BeforeTable2
	err = testEngine.Before(func(bean interface{}) {
		bean.(*BeforeTable2).Val = "val"
	}).Find(&be)
	assert.NoError(t, err)
	assert.Equal(t, 2, len(be))
	assert.Equal(t, "val", be[0].Val)
	assert.Equal(t, "test1", be[0].Name)
	assert.Equal(t, "val", be[1].Val)
	assert.Equal(t, "test2", be[1].Name)
}

type ProcessorsStruct struct {
	Id int64

	B4InsertFlag      int
	AfterInsertedFlag int
	B4UpdateFlag      int
	AfterUpdatedFlag  int
	B4DeleteFlag      int `xorm:"-"`
	AfterDeletedFlag  int `xorm:"-"`
	BeforeSetFlag     int `xorm:"-"`

	B4InsertViaExt      int
	AfterInsertedViaExt int
	B4UpdateViaExt      int
	AfterUpdatedViaExt  int
	B4DeleteViaExt      int `xorm:"-"`
	AfterDeletedViaExt  int `xorm:"-"`
	AfterSetFlag        int `xorm:"-"`
}

func (p *ProcessorsStruct) BeforeInsert() {
	p.B4InsertFlag = 1
}

func (p *ProcessorsStruct) BeforeUpdate() {
	p.B4UpdateFlag = 1
}

func (p *ProcessorsStruct) BeforeDelete() {
	p.B4DeleteFlag = 1
}

func (p *ProcessorsStruct) BeforeSet(col string, cell Cell) {
	p.BeforeSetFlag = p.BeforeSetFlag + 1
}

func (p *ProcessorsStruct) AfterInsert() {
	p.AfterInsertedFlag = 1
}

func (p *ProcessorsStruct) AfterUpdate() {
	p.AfterUpdatedFlag = 1
}

func (p *ProcessorsStruct) AfterDelete() {
	p.AfterDeletedFlag = 1
}

func (p *ProcessorsStruct) AfterSet(col string, cell Cell) {
	p.AfterSetFlag = p.AfterSetFlag + 1
}

func TestProcessors(t *testing.T) {
	assert.NoError(t, prepareEngine())

	err := testEngine.DropTables(&ProcessorsStruct{})
	if err != nil {
		t.Error(err)
		panic(err)
	}
	p := &ProcessorsStruct{}

	err = testEngine.CreateTables(&ProcessorsStruct{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	b4InsertFunc := func(bean interface{}) {
		if v, ok := (bean).(*ProcessorsStruct); ok {
			v.B4InsertViaExt = 1
		} else {
			t.Error(errors.New("cast to ProcessorsStruct failed, how can this be!?"))
		}
	}

	afterInsertFunc := func(bean interface{}) {
		if v, ok := (bean).(*ProcessorsStruct); ok {
			v.AfterInsertedViaExt = 1
		} else {
			t.Error(errors.New("cast to ProcessorsStruct failed, how can this be!?"))
		}
	}

	_, err = testEngine.Before(b4InsertFunc).After(afterInsertFunc).Insert(p)
	assert.NoError(t, err)
	assert.True(t, p.Id > 0, "Inserted ID not set")
	assert.True(t, p.B4InsertFlag > 0, "B4InsertFlag not set")
	assert.True(t, p.AfterInsertedFlag > 0, "B4InsertFlag not set")
	assert.True(t, p.B4InsertViaExt > 0, "B4InsertFlag not set")
	assert.True(t, p.AfterInsertedViaExt > 0, "AfterInsertedViaExt not set")

	p2 := &ProcessorsStruct{}
	has, err := testEngine.ID(p.Id).Get(p2)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.True(t, p2.B4InsertFlag > 0, "B4InsertFlag not set")
	assert.True(t, p2.AfterInsertedFlag == 0, "AfterInsertedFlag is set")
	assert.True(t, p2.B4InsertViaExt > 0, "B4InsertViaExt not set")
	assert.True(t, p2.AfterInsertedViaExt == 0, "AfterInsertedViaExt is set")
	assert.True(t, p2.BeforeSetFlag == 9, fmt.Sprintf("BeforeSetFlag is %d not 9", p2.BeforeSetFlag))
	assert.True(t, p2.AfterSetFlag == 9, fmt.Sprintf("AfterSetFlag is %d not 9", p2.BeforeSetFlag))
	// --

	// test find processors
	var p2Find []*ProcessorsStruct
	err = testEngine.Find(&p2Find)
	assert.NoError(t, err)

	if len(p2Find) != 1 {
		err = errors.New("Should get 1")
		t.Error(err)
	}
	p21 := p2Find[0]
	if p21.B4InsertFlag == 0 {
		t.Error(errors.New("B4InsertFlag not set"))
	}
	if p21.AfterInsertedFlag != 0 {
		t.Error(errors.New("AfterInsertedFlag is set"))
	}
	if p21.B4InsertViaExt == 0 {
		t.Error(errors.New("B4InsertViaExt not set"))
	}
	if p21.AfterInsertedViaExt != 0 {
		t.Error(errors.New("AfterInsertedViaExt is set"))
	}
	if p21.BeforeSetFlag != 9 {
		t.Error(fmt.Errorf("BeforeSetFlag is %d not 9", p21.BeforeSetFlag))
	}
	if p21.AfterSetFlag != 9 {
		t.Error(fmt.Errorf("AfterSetFlag is %d not 9", p21.BeforeSetFlag))
	}
	// --

	// test find map processors
	var p2FindMap = make(map[int64]*ProcessorsStruct)
	err = testEngine.Find(&p2FindMap)
	assert.NoError(t, err)

	if len(p2FindMap) != 1 {
		err = errors.New("Should get 1")
		t.Error(err)
	}
	var p22 *ProcessorsStruct
	for _, v := range p2FindMap {
		p22 = v
	}

	if p22.B4InsertFlag == 0 {
		t.Error(errors.New("B4InsertFlag not set"))
	}
	if p22.AfterInsertedFlag != 0 {
		t.Error(errors.New("AfterInsertedFlag is set"))
	}
	if p22.B4InsertViaExt == 0 {
		t.Error(errors.New("B4InsertViaExt not set"))
	}
	if p22.AfterInsertedViaExt != 0 {
		t.Error(errors.New("AfterInsertedViaExt is set"))
	}
	if p22.BeforeSetFlag != 9 {
		t.Error(fmt.Errorf("BeforeSetFlag is %d not 9", p22.BeforeSetFlag))
	}
	if p22.AfterSetFlag != 9 {
		t.Error(fmt.Errorf("AfterSetFlag is %d not 9", p22.BeforeSetFlag))
	}
	// --

	// test update processors
	b4UpdateFunc := func(bean interface{}) {
		if v, ok := (bean).(*ProcessorsStruct); ok {
			v.B4UpdateViaExt = 1
		} else {
			t.Error(errors.New("cast to ProcessorsStruct failed, how can this be!?"))
		}
	}

	afterUpdateFunc := func(bean interface{}) {
		if v, ok := (bean).(*ProcessorsStruct); ok {
			v.AfterUpdatedViaExt = 1
		} else {
			t.Error(errors.New("cast to ProcessorsStruct failed, how can this be!?"))
		}
	}

	p = p2 // reset

	_, err = testEngine.Before(b4UpdateFunc).After(afterUpdateFunc).Update(p)
	assert.NoError(t, err)

	if p.B4UpdateFlag == 0 {
		t.Error(errors.New("B4UpdateFlag not set"))
	}
	if p.AfterUpdatedFlag == 0 {
		t.Error(errors.New("AfterUpdatedFlag not set"))
	}
	if p.B4UpdateViaExt == 0 {
		t.Error(errors.New("B4UpdateViaExt not set"))
	}
	if p.AfterUpdatedViaExt == 0 {
		t.Error(errors.New("AfterUpdatedViaExt not set"))
	}

	p2 = &ProcessorsStruct{}
	has, err = testEngine.ID(p.Id).Get(p2)
	assert.NoError(t, err)
	assert.True(t, has)

	if p2.B4UpdateFlag == 0 {
		t.Error(errors.New("B4UpdateFlag not set"))
	}
	if p2.AfterUpdatedFlag != 0 {
		t.Error(errors.New("AfterUpdatedFlag is set: " + string(p.AfterUpdatedFlag)))
	}
	if p2.B4UpdateViaExt == 0 {
		t.Error(errors.New("B4UpdateViaExt not set"))
	}
	if p2.AfterUpdatedViaExt != 0 {
		t.Error(errors.New("AfterUpdatedViaExt is set: " + string(p.AfterUpdatedViaExt)))
	}
	if p2.BeforeSetFlag != 9 {
		t.Error(fmt.Errorf("BeforeSetFlag is %d not 9", p2.BeforeSetFlag))
	}
	if p2.AfterSetFlag != 9 {
		t.Error(fmt.Errorf("AfterSetFlag is %d not 9", p2.BeforeSetFlag))
	}
	// --

	// test delete processors
	b4DeleteFunc := func(bean interface{}) {
		if v, ok := (bean).(*ProcessorsStruct); ok {
			v.B4DeleteViaExt = 1
		} else {
			t.Error(errors.New("cast to ProcessorsStruct failed, how can this be!?"))
		}
	}

	afterDeleteFunc := func(bean interface{}) {
		if v, ok := (bean).(*ProcessorsStruct); ok {
			v.AfterDeletedViaExt = 1
		} else {
			t.Error(errors.New("cast to ProcessorsStruct failed, how can this be!?"))
		}
	}

	p = p2 // reset
	_, err = testEngine.Before(b4DeleteFunc).After(afterDeleteFunc).Delete(p)
	assert.NoError(t, err)
	if p.B4DeleteFlag == 0 {
		t.Error(errors.New("B4DeleteFlag not set"))
	}
	if p.AfterDeletedFlag == 0 {
		t.Error(errors.New("AfterDeletedFlag not set"))
	}
	if p.B4DeleteViaExt == 0 {
		t.Error(errors.New("B4DeleteViaExt not set"))
	}
	if p.AfterDeletedViaExt == 0 {
		t.Error(errors.New("AfterDeletedViaExt not set"))
	}
	// --

	// test insert multi
	pslice := make([]*ProcessorsStruct, 0)
	pslice = append(pslice, &ProcessorsStruct{})
	pslice = append(pslice, &ProcessorsStruct{})
	cnt, err := testEngine.Before(b4InsertFunc).After(afterInsertFunc).Insert(&pslice)
	assert.NoError(t, err)
	assert.EqualValues(t, 2, cnt, "incorrect insert count")

	for _, elem := range pslice {
		if elem.B4InsertFlag == 0 {
			t.Error(errors.New("B4InsertFlag not set"))
		}
		if elem.AfterInsertedFlag == 0 {
			t.Error(errors.New("B4InsertFlag not set"))
		}
		if elem.B4InsertViaExt == 0 {
			t.Error(errors.New("B4InsertFlag not set"))
		}
		if elem.AfterInsertedViaExt == 0 {
			t.Error(errors.New("AfterInsertedViaExt not set"))
		}
	}

	for _, elem := range pslice {
		p = &ProcessorsStruct{}
		_, err = testEngine.ID(elem.Id).Get(p)
		assert.NoError(t, err)

		if p2.B4InsertFlag == 0 {
			t.Error(errors.New("B4InsertFlag not set"))
		}
		if p2.AfterInsertedFlag != 0 {
			t.Error(errors.New("AfterInsertedFlag is set"))
		}
		if p2.B4InsertViaExt == 0 {
			t.Error(errors.New("B4InsertViaExt not set"))
		}
		if p2.AfterInsertedViaExt != 0 {
			t.Error(errors.New("AfterInsertedViaExt is set"))
		}
		if p2.BeforeSetFlag != 9 {
			t.Error(fmt.Errorf("BeforeSetFlag is %d not 9", p2.BeforeSetFlag))
		}
		if p2.AfterSetFlag != 9 {
			t.Error(fmt.Errorf("AfterSetFlag is %d not 9", p2.BeforeSetFlag))
		}
	}
	// --
}

func TestProcessorsTx(t *testing.T) {
	assert.NoError(t, prepareEngine())

	err := testEngine.DropTables(&ProcessorsStruct{})
	assert.NoError(t, err)

	err = testEngine.CreateTables(&ProcessorsStruct{})
	assert.NoError(t, err)

	// test insert processors with tx rollback
	session := testEngine.NewSession()
	defer session.Close()

	err = session.Begin()
	assert.NoError(t, err)

	p := &ProcessorsStruct{}
	b4InsertFunc := func(bean interface{}) {
		if v, ok := (bean).(*ProcessorsStruct); ok {
			v.B4InsertViaExt = 1
		} else {
			t.Error(errors.New("cast to ProcessorsStruct failed, how can this be!?"))
		}
	}

	afterInsertFunc := func(bean interface{}) {
		if v, ok := (bean).(*ProcessorsStruct); ok {
			v.AfterInsertedViaExt = 1
		} else {
			t.Error(errors.New("cast to ProcessorsStruct failed, how can this be!?"))
		}
	}
	_, err = session.Before(b4InsertFunc).After(afterInsertFunc).Insert(p)
	assert.NoError(t, err)

	if p.B4InsertFlag == 0 {
		t.Error(errors.New("B4InsertFlag not set"))
	}
	if p.AfterInsertedFlag != 0 {
		t.Error(errors.New("B4InsertFlag is set"))
	}
	if p.B4InsertViaExt == 0 {
		t.Error(errors.New("B4InsertViaExt not set"))
	}
	if p.AfterInsertedViaExt != 0 {
		t.Error(errors.New("AfterInsertedViaExt is set"))
	}

	err = session.Rollback()
	assert.NoError(t, err)

	if p.B4InsertFlag == 0 {
		t.Error(errors.New("B4InsertFlag not set"))
	}
	if p.AfterInsertedFlag != 0 {
		t.Error(errors.New("B4InsertFlag is set"))
	}
	if p.B4InsertViaExt == 0 {
		t.Error(errors.New("B4InsertViaExt not set"))
	}
	if p.AfterInsertedViaExt != 0 {
		t.Error(errors.New("AfterInsertedViaExt is set"))
	}

	session.Close()

	p2 := &ProcessorsStruct{}
	_, err = testEngine.ID(p.Id).Get(p2)
	assert.NoError(t, err)

	if p2.Id > 0 {
		err = errors.New("tx got committed upon insert!?")
		t.Error(err)
		panic(err)
	}
	// --

	// test insert processors with tx commit
	session = testEngine.NewSession()
	defer session.Close()

	err = session.Begin()
	assert.NoError(t, err)

	p = &ProcessorsStruct{}
	_, err = session.Before(b4InsertFunc).After(afterInsertFunc).Insert(p)
	assert.NoError(t, err)

	if p.B4InsertFlag == 0 {
		t.Error(errors.New("B4InsertFlag not set"))
	}
	if p.AfterInsertedFlag != 0 {
		t.Error(errors.New("AfterInsertedFlag is set"))
	}
	if p.B4InsertViaExt == 0 {
		t.Error(errors.New("B4InsertViaExt not set"))
	}
	if p.AfterInsertedViaExt != 0 {
		t.Error(errors.New("AfterInsertedViaExt is set"))
	}

	err = session.Commit()
	assert.NoError(t, err)

	if p.B4InsertFlag == 0 {
		t.Error(errors.New("B4InsertFlag not set"))
	}
	if p.AfterInsertedFlag == 0 {
		t.Error(errors.New("AfterInsertedFlag not set"))
	}
	if p.B4InsertViaExt == 0 {
		t.Error(errors.New("B4InsertViaExt not set"))
	}
	if p.AfterInsertedViaExt == 0 {
		t.Error(errors.New("AfterInsertedViaExt not set"))
	}

	session.Close()
	p2 = &ProcessorsStruct{}
	_, err = testEngine.ID(p.Id).Get(p2)
	assert.NoError(t, err)

	if p2.B4InsertFlag == 0 {
		t.Error(errors.New("B4InsertFlag not set"))
	}
	if p2.AfterInsertedFlag != 0 {
		t.Error(errors.New("AfterInsertedFlag is set"))
	}
	if p2.B4InsertViaExt == 0 {
		t.Error(errors.New("B4InsertViaExt not set"))
	}
	if p2.AfterInsertedViaExt != 0 {
		t.Error(errors.New("AfterInsertedViaExt is set"))
	}

	insertedId := p2.Id
	// --

	// test update processors with tx rollback
	session = testEngine.NewSession()
	defer session.Close()

	err = session.Begin()
	assert.NoError(t, err)

	b4UpdateFunc := func(bean interface{}) {
		if v, ok := (bean).(*ProcessorsStruct); ok {
			v.B4UpdateViaExt = 1
		} else {
			t.Error(errors.New("cast to ProcessorsStruct failed, how can this be!?"))
		}
	}

	afterUpdateFunc := func(bean interface{}) {
		if v, ok := (bean).(*ProcessorsStruct); ok {
			v.AfterUpdatedViaExt = 1
		} else {
			t.Error(errors.New("cast to ProcessorsStruct failed, how can this be!?"))
		}
	}

	p = p2 // reset

	_, err = session.ID(insertedId).Before(b4UpdateFunc).After(afterUpdateFunc).Update(p)
	assert.NoError(t, err)

	if p.B4UpdateFlag == 0 {
		t.Error(errors.New("B4UpdateFlag not set"))
	}
	if p.AfterUpdatedFlag != 0 {
		t.Error(errors.New("AfterUpdatedFlag is set"))
	}
	if p.B4UpdateViaExt == 0 {
		t.Error(errors.New("B4UpdateViaExt not set"))
	}
	if p.AfterUpdatedViaExt != 0 {
		t.Error(errors.New("AfterUpdatedViaExt is set"))
	}

	err = session.Rollback()
	assert.NoError(t, err)

	if p.B4UpdateFlag == 0 {
		t.Error(errors.New("B4UpdateFlag not set"))
	}
	if p.AfterUpdatedFlag != 0 {
		t.Error(errors.New("AfterUpdatedFlag is set"))
	}
	if p.B4UpdateViaExt == 0 {
		t.Error(errors.New("B4UpdateViaExt not set"))
	}
	if p.AfterUpdatedViaExt != 0 {
		t.Error(errors.New("AfterUpdatedViaExt is set"))
	}

	session.Close()

	p2 = &ProcessorsStruct{}
	_, err = testEngine.ID(insertedId).Get(p2)
	assert.NoError(t, err)

	if p2.B4UpdateFlag != 0 {
		t.Error(errors.New("B4UpdateFlag is set"))
	}
	if p2.AfterUpdatedFlag != 0 {
		t.Error(errors.New("AfterUpdatedFlag is set"))
	}
	if p2.B4UpdateViaExt != 0 {
		t.Error(errors.New("B4UpdateViaExt not set"))
	}
	if p2.AfterUpdatedViaExt != 0 {
		t.Error(errors.New("AfterUpdatedViaExt is set"))
	}
	// --

	// test update processors with tx rollback
	session = testEngine.NewSession()
	defer session.Close()

	err = session.Begin()
	assert.NoError(t, err)

	p = &ProcessorsStruct{Id: insertedId}

	_, err = session.Update(p)
	assert.NoError(t, err)

	if p.B4UpdateFlag == 0 {
		t.Error(errors.New("B4UpdateFlag not set"))
	}
	if p.AfterUpdatedFlag != 0 {
		t.Error(errors.New("AfterUpdatedFlag is set"))
	}

	err = session.Commit()
	assert.NoError(t, err)

	if p.B4UpdateFlag == 0 {
		t.Error(errors.New("B4UpdateFlag not set"))
	}
	if p.AfterUpdatedFlag == 0 {
		t.Error(errors.New("AfterUpdatedFlag not set"))
	}
	if p.AfterDeletedFlag != 0 {
		t.Error(errors.New("AfterDeletedFlag set"))
	}
	if p.AfterInsertedFlag != 0 {
		t.Error(errors.New("AfterInsertedFlag set"))
	}

	session.Close()

	// test update processors with tx commit
	session = testEngine.NewSession()
	defer session.Close()

	err = session.Begin()
	assert.NoError(t, err)

	p = &ProcessorsStruct{}

	_, err = session.ID(insertedId).Before(b4UpdateFunc).After(afterUpdateFunc).Update(p)
	assert.NoError(t, err)

	if p.B4UpdateFlag == 0 {
		t.Error(errors.New("B4UpdateFlag not set"))
	}
	if p.AfterUpdatedFlag != 0 {
		t.Error(errors.New("AfterUpdatedFlag is set"))
	}
	if p.B4UpdateViaExt == 0 {
		t.Error(errors.New("B4UpdateViaExt not set"))
	}
	if p.AfterUpdatedViaExt != 0 {
		t.Error(errors.New("AfterUpdatedViaExt is set"))
	}

	err = session.Commit()
	assert.NoError(t, err)

	if p.B4UpdateFlag == 0 {
		t.Error(errors.New("B4UpdateFlag not set"))
	}
	if p.AfterUpdatedFlag == 0 {
		t.Error(errors.New("AfterUpdatedFlag not set"))
	}
	if p.B4UpdateViaExt == 0 {
		t.Error(errors.New("B4UpdateViaExt not set"))
	}
	if p.AfterUpdatedViaExt == 0 {
		t.Error(errors.New("AfterUpdatedViaExt not set"))
	}

	session.Close()
	p2 = &ProcessorsStruct{}
	_, err = testEngine.ID(insertedId).Get(p2)
	assert.NoError(t, err)

	if p.B4UpdateFlag == 0 {
		t.Error(errors.New("B4UpdateFlag not set"))
	}
	if p.AfterUpdatedFlag == 0 {
		t.Error(errors.New("AfterUpdatedFlag not set"))
	}
	if p.B4UpdateViaExt == 0 {
		t.Error(errors.New("B4UpdateViaExt not set"))
	}
	if p.AfterUpdatedViaExt == 0 {
		t.Error(errors.New("AfterUpdatedViaExt not set"))
	}
	// --

	// test delete processors with tx rollback
	session = testEngine.NewSession()
	defer session.Close()

	err = session.Begin()
	assert.NoError(t, err)

	b4DeleteFunc := func(bean interface{}) {
		if v, ok := (bean).(*ProcessorsStruct); ok {
			v.B4DeleteViaExt = 1
		} else {
			t.Error(errors.New("cast to ProcessorsStruct failed, how can this be!?"))
		}
	}

	afterDeleteFunc := func(bean interface{}) {
		if v, ok := (bean).(*ProcessorsStruct); ok {
			v.AfterDeletedViaExt = 1
		} else {
			t.Error(errors.New("cast to ProcessorsStruct failed, how can this be!?"))
		}
	}

	p = &ProcessorsStruct{} // reset

	_, err = session.ID(insertedId).Before(b4DeleteFunc).After(afterDeleteFunc).Delete(p)
	assert.NoError(t, err)

	if p.B4DeleteFlag == 0 {
		t.Error(errors.New("B4DeleteFlag not set"))
	}
	if p.AfterDeletedFlag != 0 {
		t.Error(errors.New("AfterDeletedFlag is set"))
	}
	if p.B4DeleteViaExt == 0 {
		t.Error(errors.New("B4DeleteViaExt not set"))
	}
	if p.AfterDeletedViaExt != 0 {
		t.Error(errors.New("AfterDeletedViaExt is set"))
	}

	err = session.Rollback()
	assert.NoError(t, err)
	if p.B4DeleteFlag == 0 {
		t.Error(errors.New("B4DeleteFlag not set"))
	}
	if p.AfterDeletedFlag != 0 {
		t.Error(errors.New("AfterDeletedFlag is set"))
	}
	if p.B4DeleteViaExt == 0 {
		t.Error(errors.New("B4DeleteViaExt not set"))
	}
	if p.AfterDeletedViaExt != 0 {
		t.Error(errors.New("AfterDeletedViaExt is set"))
	}

	session.Close()

	p2 = &ProcessorsStruct{}
	_, err = testEngine.ID(insertedId).Get(p2)
	assert.NoError(t, err)

	if p2.B4DeleteFlag != 0 {
		t.Error(errors.New("B4DeleteFlag is set"))
	}
	if p2.AfterDeletedFlag != 0 {
		t.Error(errors.New("AfterDeletedFlag is set"))
	}
	if p2.B4DeleteViaExt != 0 {
		t.Error(errors.New("B4DeleteViaExt is set"))
	}
	if p2.AfterDeletedViaExt != 0 {
		t.Error(errors.New("AfterDeletedViaExt is set"))
	}
	// --

	// test delete processors with tx commit
	session = testEngine.NewSession()
	defer session.Close()

	err = session.Begin()
	assert.NoError(t, err)

	p = &ProcessorsStruct{}

	_, err = session.ID(insertedId).Before(b4DeleteFunc).After(afterDeleteFunc).Delete(p)
	assert.NoError(t, err)

	if p.B4DeleteFlag == 0 {
		t.Error(errors.New("B4DeleteFlag not set"))
	}
	if p.AfterDeletedFlag != 0 {
		t.Error(errors.New("AfterDeletedFlag is set"))
	}
	if p.B4DeleteViaExt == 0 {
		t.Error(errors.New("B4DeleteViaExt not set"))
	}
	if p.AfterDeletedViaExt != 0 {
		t.Error(errors.New("AfterDeletedViaExt is set"))
	}

	err = session.Commit()
	assert.NoError(t, err)

	if p.B4DeleteFlag == 0 {
		t.Error(errors.New("B4DeleteFlag not set"))
	}
	if p.AfterDeletedFlag == 0 {
		t.Error(errors.New("AfterDeletedFlag not set"))
	}
	if p.B4DeleteViaExt == 0 {
		t.Error(errors.New("B4DeleteViaExt not set"))
	}
	if p.AfterDeletedViaExt == 0 {
		t.Error(errors.New("AfterDeletedViaExt not set"))
	}

	session.Close()

	// test delete processors with tx commit
	session = testEngine.NewSession()
	defer session.Close()

	err = session.Begin()
	assert.NoError(t, err)

	p = &ProcessorsStruct{Id: insertedId}
	_, err = session.Delete(p)
	assert.NoError(t, err)

	if p.B4DeleteFlag == 0 {
		t.Error(errors.New("B4DeleteFlag not set"))
	}
	if p.AfterDeletedFlag != 0 {
		t.Error(errors.New("AfterDeletedFlag is set"))
	}

	err = session.Commit()
	assert.NoError(t, err)

	if p.B4DeleteFlag == 0 {
		t.Error(errors.New("B4DeleteFlag not set"))
	}
	if p.AfterDeletedFlag == 0 {
		t.Error(errors.New("AfterDeletedFlag not set"))
	}
	if p.AfterInsertedFlag != 0 {
		t.Error(errors.New("AfterInsertedFlag set"))
	}
	if p.AfterUpdatedFlag != 0 {
		t.Error(errors.New("AfterUpdatedFlag set"))
	}
	session.Close()
	// --
}

type AfterLoadStructA struct {
	Id      int64
	Content string
}

type AfterLoadStructB struct {
	Id      int64
	Content string
	AId     int64
	A       AfterLoadStructA `xorm:"-"`
	Err     error            `xorm:"-"`
}

func (s *AfterLoadStructB) AfterLoad(session *Session) {
	has, err := session.ID(s.AId).NoAutoCondition().Get(&s.A)
	if err != nil {
		s.Err = err
		return
	}
	if !has {
		s.Err = ErrNotExist
	}
}

func TestAfterLoadProcessor(t *testing.T) {
	assert.NoError(t, prepareEngine())

	assertSync(t, new(AfterLoadStructA), new(AfterLoadStructB))

	var a = AfterLoadStructA{
		Content: "testa",
	}
	_, err := testEngine.Insert(&a)
	assert.NoError(t, err)

	var b = AfterLoadStructB{
		Content: "testb",
		AId:     a.Id,
	}
	_, err = testEngine.Insert(&b)
	assert.NoError(t, err)

	var b2 AfterLoadStructB
	has, err := testEngine.ID(b.Id).Get(&b2)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, a.Id, b2.A.Id)
	assert.EqualValues(t, a.Content, b2.A.Content)
	assert.NoError(t, b2.Err)

	b.Id = 0
	_, err = testEngine.Insert(&b)
	assert.NoError(t, err)

	var bs []AfterLoadStructB
	err = testEngine.Find(&bs)
	assert.NoError(t, err)
	assert.EqualValues(t, 2, len(bs))
	for i := 0; i < len(bs); i++ {
		assert.EqualValues(t, a.Id, bs[i].A.Id)
		assert.EqualValues(t, a.Content, bs[i].A.Content)
		assert.NoError(t, bs[i].Err)
	}
}

type AfterInsertStruct struct {
	Id int64
}

func (a *AfterInsertStruct) AfterInsert() {
	if a.Id == 0 {
		panic("a.Id")
	}
}

func TestAfterInsert(t *testing.T) {
	assert.NoError(t, prepareEngine())

	assertSync(t, new(AfterInsertStruct))

	_, err := testEngine.Insert(&AfterInsertStruct{})
	assert.NoError(t, err)
}
