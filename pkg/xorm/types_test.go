// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"xorm.io/core"
)

func TestArrayField(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type ArrayStruct struct {
		Id   int64
		Name [20]byte `xorm:"char(80)"`
	}

	assert.NoError(t, testEngine.Sync2(new(ArrayStruct)))

	var as = ArrayStruct{
		Name: [20]byte{
			96, 96, 96, 96, 96,
			96, 96, 96, 96, 96,
			96, 96, 96, 96, 96,
			96, 96, 96, 96, 96,
		},
	}
	cnt, err := testEngine.Insert(&as)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	var arr ArrayStruct
	has, err := testEngine.ID(1).Get(&arr)
	assert.NoError(t, err)
	assert.Equal(t, true, has)
	assert.Equal(t, as.Name, arr.Name)

	var arrs []ArrayStruct
	err = testEngine.Find(&arrs)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, len(arrs))
	assert.Equal(t, as.Name, arrs[0].Name)

	var newName = [20]byte{
		90, 96, 96, 96, 96,
		96, 96, 96, 96, 96,
		96, 96, 96, 96, 96,
		96, 96, 96, 96, 96,
	}

	cnt, err = testEngine.ID(1).Update(&ArrayStruct{
		Name: newName,
	})
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	var newArr ArrayStruct
	has, err = testEngine.ID(1).Get(&newArr)
	assert.NoError(t, err)
	assert.Equal(t, true, has)
	assert.Equal(t, newName, newArr.Name)

	cnt, err = testEngine.ID(1).Delete(new(ArrayStruct))
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	var cfgArr ArrayStruct
	has, err = testEngine.ID(1).Get(&cfgArr)
	assert.NoError(t, err)
	assert.Equal(t, false, has)
}

func TestGetBytes(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type Varbinary struct {
		Data []byte `xorm:"VARBINARY(250)"`
	}

	err := testEngine.Sync2(new(Varbinary))
	assert.NoError(t, err)

	cnt, err := testEngine.Insert(&Varbinary{
		Data: []byte("test"),
	})
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	var b Varbinary
	has, err := testEngine.Get(&b)
	assert.NoError(t, err)
	assert.Equal(t, true, has)
	assert.Equal(t, "test", string(b.Data))
}

type ConvString string

func (s *ConvString) FromDB(data []byte) error {
	*s = ConvString("prefix---" + string(data))
	return nil
}

func (s *ConvString) ToDB() ([]byte, error) {
	return []byte(string(*s)), nil
}

type ConvConfig struct {
	Name string
	Id   int64
}

func (s *ConvConfig) FromDB(data []byte) error {
	return DefaultJSONHandler.Unmarshal(data, s)
}

func (s *ConvConfig) ToDB() ([]byte, error) {
	return DefaultJSONHandler.Marshal(s)
}

type SliceType []*ConvConfig

func (s *SliceType) FromDB(data []byte) error {
	return DefaultJSONHandler.Unmarshal(data, s)
}

func (s *SliceType) ToDB() ([]byte, error) {
	return DefaultJSONHandler.Marshal(s)
}

type ConvStruct struct {
	Conv  ConvString
	Conv2 *ConvString
	Cfg1  ConvConfig
	Cfg2  *ConvConfig     `xorm:"TEXT"`
	Cfg3  core.Conversion `xorm:"BLOB"`
	Slice SliceType
}

func (c *ConvStruct) BeforeSet(name string, cell Cell) {
	if name == "cfg3" || name == "Cfg3" {
		c.Cfg3 = new(ConvConfig)
	}
}

func TestConversion(t *testing.T) {
	assert.NoError(t, prepareEngine())

	c := new(ConvStruct)
	assert.NoError(t, testEngine.DropTables(c))
	assert.NoError(t, testEngine.Sync2(c))

	var s ConvString = "sssss"
	c.Conv = "tttt"
	c.Conv2 = &s
	c.Cfg1 = ConvConfig{"mm", 1}
	c.Cfg2 = &ConvConfig{"xx", 2}
	c.Cfg3 = &ConvConfig{"zz", 3}
	c.Slice = []*ConvConfig{{"yy", 4}, {"ff", 5}}

	_, err := testEngine.Insert(c)
	assert.NoError(t, err)

	c1 := new(ConvStruct)
	has, err := testEngine.Get(c1)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, "prefix---tttt", string(c1.Conv))
	assert.NotNil(t, c1.Conv2)
	assert.EqualValues(t, "prefix---"+s, *c1.Conv2)
	assert.EqualValues(t, c.Cfg1, c1.Cfg1)
	assert.NotNil(t, c1.Cfg2)
	assert.EqualValues(t, *c.Cfg2, *c1.Cfg2)
	assert.NotNil(t, c1.Cfg3)
	assert.EqualValues(t, *c.Cfg3.(*ConvConfig), *c1.Cfg3.(*ConvConfig))
	assert.EqualValues(t, 2, len(c1.Slice))
	assert.EqualValues(t, *c.Slice[0], *c1.Slice[0])
	assert.EqualValues(t, *c.Slice[1], *c1.Slice[1])
}

type MyInt int
type MyUInt uint
type MyFloat float64

type MyStruct struct {
	Type      MyInt
	U         MyUInt
	F         MyFloat
	S         MyString
	IA        []MyInt
	UA        []MyUInt
	FA        []MyFloat
	SA        []MyString
	NameArray []string
	Name      string
	UIA       []uint
	UIA8      []uint8
	UIA16     []uint16
	UIA32     []uint32
	UIA64     []uint64
	UI        uint
	//C64       complex64
	MSS map[string]string
}

func TestCustomType1(t *testing.T) {
	assert.NoError(t, prepareEngine())

	err := testEngine.DropTables(&MyStruct{})
	assert.NoError(t, err)

	err = testEngine.CreateTables(&MyStruct{})
	assert.NoError(t, err)

	i := MyStruct{Name: "Test", Type: MyInt(1)}
	i.U = 23
	i.F = 1.34
	i.S = "fafdsafdsaf"
	i.UI = 2
	i.IA = []MyInt{1, 3, 5}
	i.UIA = []uint{1, 3}
	i.UIA16 = []uint16{2}
	i.UIA32 = []uint32{4, 5}
	i.UIA64 = []uint64{6, 7, 9}
	i.UIA8 = []uint8{1, 2, 3, 4}
	i.NameArray = []string{"ssss", "fsdf", "lllll, ss"}
	i.MSS = map[string]string{"s": "sfds,ss", "x": "lfjljsl"}

	cnt, err := testEngine.Insert(&i)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	fmt.Println(i)
	i.NameArray = []string{}
	i.MSS = map[string]string{}
	i.F = 0
	has, err := testEngine.Get(&i)
	assert.NoError(t, err)
	assert.True(t, has)

	ss := []MyStruct{}
	err = testEngine.Find(&ss)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, len(ss))
	assert.EqualValues(t, i, ss[0])

	sss := MyStruct{}
	has, err = testEngine.Get(&sss)
	assert.NoError(t, err)
	assert.True(t, has)

	sss.NameArray = []string{}
	sss.MSS = map[string]string{}
	cnt, err = testEngine.Delete(&sss)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)
}

type Status struct {
	Name  string
	Color string
}

var (
	_          core.Conversion   = &Status{}
	Registered Status            = Status{"Registered", "white"}
	Approved   Status            = Status{"Approved", "green"}
	Removed    Status            = Status{"Removed", "red"}
	Statuses   map[string]Status = map[string]Status{
		Registered.Name: Registered,
		Approved.Name:   Approved,
		Removed.Name:    Removed,
	}
)

func (s *Status) FromDB(bytes []byte) error {
	if r, ok := Statuses[string(bytes)]; ok {
		*s = r
		return nil
	} else {
		return errors.New("no this data")
	}
}

func (s *Status) ToDB() ([]byte, error) {
	return []byte(s.Name), nil
}

type UserCus struct {
	Id     int64
	Name   string
	Status Status `xorm:"varchar(40)"`
}

func TestCustomType2(t *testing.T) {
	assert.NoError(t, prepareEngine())

	var uc UserCus
	err := testEngine.CreateTables(&uc)
	assert.NoError(t, err)

	tableName := testEngine.TableName(&uc, true)
	_, err = testEngine.Exec("delete from " + testEngine.Quote(tableName))
	assert.NoError(t, err)

	session := testEngine.NewSession()
	defer session.Close()

	cnt, err := session.Insert(&UserCus{1, "xlw", Registered})
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	user := UserCus{}
	exist, err := testEngine.ID(1).Get(&user)
	assert.NoError(t, err)
	assert.True(t, exist)

	fmt.Println(user)

	users := make([]UserCus, 0)
	err = testEngine.Where("`"+testEngine.GetColumnMapper().Obj2Table("Status")+"` = ?", "Registered").Find(&users)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, len(users))

	fmt.Println(users)
}
