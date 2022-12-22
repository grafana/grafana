// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"errors"
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestInsertOne(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type Test struct {
		Id      int64     `xorm:"autoincr pk"`
		Msg     string    `xorm:"varchar(255)"`
		Created time.Time `xorm:"created"`
	}

	assert.NoError(t, testEngine.Sync2(new(Test)))

	data := Test{Msg: "hi"}
	_, err := testEngine.InsertOne(data)
	assert.NoError(t, err)
}

func TestInsertMulti(t *testing.T) {

	assert.NoError(t, prepareEngine())
	type TestMulti struct {
		Id   int64  `xorm:"int(11) pk"`
		Name string `xorm:"varchar(255)"`
	}

	assert.NoError(t, testEngine.Sync2(new(TestMulti)))

	num, err := insertMultiDatas(1,
		append([]TestMulti{}, TestMulti{1, "test1"}, TestMulti{2, "test2"}, TestMulti{3, "test3"}))
	assert.NoError(t, err)
	assert.EqualValues(t, 3, num)
}

func insertMultiDatas(step int, datas interface{}) (num int64, err error) {
	sliceValue := reflect.Indirect(reflect.ValueOf(datas))
	var iLen int64
	if sliceValue.Kind() != reflect.Slice {
		return 0, fmt.Errorf("not silce")
	}
	iLen = int64(sliceValue.Len())
	if iLen == 0 {
		return
	}

	session := testEngine.NewSession()
	defer session.Close()

	if err = callbackLooper(datas, step,
		func(innerDatas interface{}) error {
			n, e := session.InsertMulti(innerDatas)
			if e != nil {
				return e
			}
			num += n
			return nil
		}); err != nil {
		return 0, err
	} else if num != iLen {
		return 0, fmt.Errorf("num error: %d - %d", num, iLen)
	}
	return
}

func callbackLooper(datas interface{}, step int, actionFunc func(interface{}) error) (err error) {

	sliceValue := reflect.Indirect(reflect.ValueOf(datas))
	if sliceValue.Kind() != reflect.Slice {
		return fmt.Errorf("not slice")
	}
	if sliceValue.Len() <= 0 {
		return
	}

	tempLen := 0
	processedLen := sliceValue.Len()
	for i := 0; i < sliceValue.Len(); i += step {
		if processedLen > step {
			tempLen = i + step
		} else {
			tempLen = sliceValue.Len()
		}
		var tempInterface []interface{}
		for j := i; j < tempLen; j++ {
			tempInterface = append(tempInterface, sliceValue.Index(j).Interface())
		}
		if err = actionFunc(tempInterface); err != nil {
			return
		}
		processedLen = processedLen - step
	}
	return
}

func TestInsertOneIfPkIsPoint(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type TestPoint struct {
		Id      *int64     `xorm:"autoincr pk notnull 'id'"`
		Msg     *string    `xorm:"varchar(255)"`
		Created *time.Time `xorm:"created"`
	}

	assert.NoError(t, testEngine.Sync2(new(TestPoint)))
	msg := "hi"
	data := TestPoint{Msg: &msg}
	_, err := testEngine.InsertOne(&data)
	assert.NoError(t, err)
}

func TestInsertOneIfPkIsPointRename(t *testing.T) {
	assert.NoError(t, prepareEngine())
	type ID *int64
	type TestPoint2 struct {
		Id      ID         `xorm:"autoincr pk notnull 'id'"`
		Msg     *string    `xorm:"varchar(255)"`
		Created *time.Time `xorm:"created"`
	}

	assert.NoError(t, testEngine.Sync2(new(TestPoint2)))
	msg := "hi"
	data := TestPoint2{Msg: &msg}
	_, err := testEngine.InsertOne(&data)
	assert.NoError(t, err)
}

func TestInsert(t *testing.T) {
	assert.NoError(t, prepareEngine())
	assertSync(t, new(Userinfo))

	user := Userinfo{0, "xiaolunwen", "dev", "lunny", time.Now(),
		Userdetail{Id: 1}, 1.78, []byte{1, 2, 3}, true}
	cnt, err := testEngine.Insert(&user)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt, "insert not returned 1")
	assert.True(t, user.Uid > 0, "not return id error")

	user.Uid = 0
	cnt, err = testEngine.Insert(&user)
	// Username is unique, so this should return error
	assert.Error(t, err, "insert should fail but no error returned")
	assert.EqualValues(t, 0, cnt, "insert not returned 1")
	if err == nil {
		panic("should return err")
	}
}

func TestInsertAutoIncr(t *testing.T) {
	assert.NoError(t, prepareEngine())
	assertSync(t, new(Userinfo))

	// auto increment insert
	user := Userinfo{Username: "xiaolunwen2", Departname: "dev", Alias: "lunny", Created: time.Now(),
		Detail: Userdetail{Id: 1}, Height: 1.78, Avatar: []byte{1, 2, 3}, IsMan: true}
	cnt, err := testEngine.Insert(&user)
	fmt.Println(user.Uid)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if cnt != 1 {
		err = errors.New("insert not returned 1")
		t.Error(err)
		panic(err)
	}
	if user.Uid <= 0 {
		t.Error(errors.New("not return id error"))
	}
}

type DefaultInsert struct {
	Id      int64
	Status  int `xorm:"default -1"`
	Name    string
	Created time.Time `xorm:"created"`
	Updated time.Time `xorm:"updated"`
}

func TestInsertDefault(t *testing.T) {
	assert.NoError(t, prepareEngine())

	di := new(DefaultInsert)
	err := testEngine.Sync2(di)
	assert.NoError(t, err)

	var di2 = DefaultInsert{Name: "test"}
	_, err = testEngine.Omit(testEngine.GetColumnMapper().Obj2Table("Status")).Insert(&di2)
	assert.NoError(t, err)

	has, err := testEngine.Desc("(id)").Get(di)
	assert.NoError(t, err)
	if !has {
		err = errors.New("error with no data")
		t.Error(err)
		panic(err)
	}
	if di.Status != -1 {
		err = errors.New("inserted error data")
		t.Error(err)
		panic(err)
	}
	if di2.Updated.Unix() != di.Updated.Unix() {
		err = errors.New("updated should equal")
		t.Error(err, di.Updated, di2.Updated)
		panic(err)
	}
	if di2.Created.Unix() != di.Created.Unix() {
		err = errors.New("created should equal")
		t.Error(err, di.Created, di2.Created)
		panic(err)
	}
}

type DefaultInsert2 struct {
	Id        int64
	Name      string
	Url       string    `xorm:"text"`
	CheckTime time.Time `xorm:"not null default '2000-01-01 00:00:00' TIMESTAMP"`
}

func TestInsertDefault2(t *testing.T) {
	assert.NoError(t, prepareEngine())

	di := new(DefaultInsert2)
	err := testEngine.Sync2(di)
	if err != nil {
		t.Error(err)
	}

	var di2 = DefaultInsert2{Name: "test"}
	_, err = testEngine.Omit(testEngine.GetColumnMapper().Obj2Table("CheckTime")).Insert(&di2)
	if err != nil {
		t.Error(err)
	}

	has, err := testEngine.Desc("(id)").Get(di)
	if err != nil {
		t.Error(err)
	}
	if !has {
		err = errors.New("error with no data")
		t.Error(err)
		panic(err)
	}

	has, err = testEngine.NoAutoCondition().Desc("(id)").Get(&di2)
	if err != nil {
		t.Error(err)
	}

	if !has {
		err = errors.New("error with no data")
		t.Error(err)
		panic(err)
	}

	if *di != di2 {
		err = fmt.Errorf("%v is not equal to %v", di, di2)
		t.Error(err)
		panic(err)
	}

	/*if di2.Updated.Unix() != di.Updated.Unix() {
		err = errors.New("updated should equal")
		t.Error(err, di.Updated, di2.Updated)
		panic(err)
	}
	if di2.Created.Unix() != di.Created.Unix() {
		err = errors.New("created should equal")
		t.Error(err, di.Created, di2.Created)
		panic(err)
	}*/
}

type CreatedInsert struct {
	Id      int64
	Created time.Time `xorm:"created"`
}

type CreatedInsert2 struct {
	Id      int64
	Created int64 `xorm:"created"`
}

type CreatedInsert3 struct {
	Id      int64
	Created int `xorm:"created bigint"`
}

type CreatedInsert4 struct {
	Id      int64
	Created int `xorm:"created"`
}

type CreatedInsert5 struct {
	Id      int64
	Created time.Time `xorm:"created bigint"`
}

type CreatedInsert6 struct {
	Id      int64
	Created time.Time `xorm:"created bigint"`
}

func TestInsertCreated(t *testing.T) {
	assert.NoError(t, prepareEngine())

	di := new(CreatedInsert)
	err := testEngine.Sync2(di)
	if err != nil {
		t.Fatal(err)
	}
	ci := &CreatedInsert{}
	_, err = testEngine.Insert(ci)
	if err != nil {
		t.Fatal(err)
	}

	has, err := testEngine.Desc("(id)").Get(di)
	if err != nil {
		t.Fatal(err)
	}
	if !has {
		t.Fatal(ErrNotExist)
	}
	if ci.Created.Unix() != di.Created.Unix() {
		t.Fatal("should equal:", ci, di)
	}
	fmt.Println("ci:", ci, "di:", di)

	di2 := new(CreatedInsert2)
	err = testEngine.Sync2(di2)
	if err != nil {
		t.Fatal(err)
	}
	ci2 := &CreatedInsert2{}
	_, err = testEngine.Insert(ci2)
	if err != nil {
		t.Fatal(err)
	}
	has, err = testEngine.Desc("(id)").Get(di2)
	if err != nil {
		t.Fatal(err)
	}
	if !has {
		t.Fatal(ErrNotExist)
	}
	if ci2.Created != di2.Created {
		t.Fatal("should equal:", ci2, di2)
	}
	fmt.Println("ci2:", ci2, "di2:", di2)

	di3 := new(CreatedInsert3)
	err = testEngine.Sync2(di3)
	if err != nil {
		t.Fatal(err)
	}
	ci3 := &CreatedInsert3{}
	_, err = testEngine.Insert(ci3)
	if err != nil {
		t.Fatal(err)
	}
	has, err = testEngine.Desc("(id)").Get(di3)
	if err != nil {
		t.Fatal(err)
	}
	if !has {
		t.Fatal(ErrNotExist)
	}
	if ci3.Created != di3.Created {
		t.Fatal("should equal:", ci3, di3)
	}
	fmt.Println("ci3:", ci3, "di3:", di3)

	di4 := new(CreatedInsert4)
	err = testEngine.Sync2(di4)
	if err != nil {
		t.Fatal(err)
	}
	ci4 := &CreatedInsert4{}
	_, err = testEngine.Insert(ci4)
	if err != nil {
		t.Fatal(err)
	}
	has, err = testEngine.Desc("(id)").Get(di4)
	if err != nil {
		t.Fatal(err)
	}
	if !has {
		t.Fatal(ErrNotExist)
	}
	if ci4.Created != di4.Created {
		t.Fatal("should equal:", ci4, di4)
	}
	fmt.Println("ci4:", ci4, "di4:", di4)

	di5 := new(CreatedInsert5)
	err = testEngine.Sync2(di5)
	if err != nil {
		t.Fatal(err)
	}
	ci5 := &CreatedInsert5{}
	_, err = testEngine.Insert(ci5)
	if err != nil {
		t.Fatal(err)
	}
	has, err = testEngine.Desc("(id)").Get(di5)
	if err != nil {
		t.Fatal(err)
	}
	if !has {
		t.Fatal(ErrNotExist)
	}
	if ci5.Created.Unix() != di5.Created.Unix() {
		t.Fatal("should equal:", ci5, di5)
	}
	fmt.Println("ci5:", ci5, "di5:", di5)

	di6 := new(CreatedInsert6)
	err = testEngine.Sync2(di6)
	if err != nil {
		t.Fatal(err)
	}
	oldTime := time.Now().Add(-time.Hour)
	ci6 := &CreatedInsert6{Created: oldTime}
	_, err = testEngine.Insert(ci6)
	if err != nil {
		t.Fatal(err)
	}

	has, err = testEngine.Desc("(id)").Get(di6)
	if err != nil {
		t.Fatal(err)
	}
	if !has {
		t.Fatal(ErrNotExist)
	}
	if ci6.Created.Unix() != di6.Created.Unix() {
		t.Fatal("should equal:", ci6, di6)
	}
	fmt.Println("ci6:", ci6, "di6:", di6)
}

type JsonTime time.Time

func (j JsonTime) format() string {
	t := time.Time(j)
	if t.IsZero() {
		return ""
	}

	return t.Format("2006-01-02")
}

func (j JsonTime) MarshalText() ([]byte, error) {
	return []byte(j.format()), nil
}

func (j JsonTime) MarshalJSON() ([]byte, error) {
	return []byte(`"` + j.format() + `"`), nil
}

func TestDefaultTime3(t *testing.T) {
	type PrepareTask struct {
		Id int `xorm:"not null pk autoincr INT(11)" json:"id"`
		// ...
		StartTime JsonTime `xorm:"not null default '2006-01-02 15:04:05' TIMESTAMP index" json:"start_time"`
		EndTime   JsonTime `xorm:"not null default '2006-01-02 15:04:05' TIMESTAMP" json:"end_time"`
		Cuser     string   `xorm:"not null default '' VARCHAR(64) index" json:"cuser"`
		Muser     string   `xorm:"not null default '' VARCHAR(64)" json:"muser"`
		Ctime     JsonTime `xorm:"not null default CURRENT_TIMESTAMP TIMESTAMP created" json:"ctime"`
		Mtime     JsonTime `xorm:"not null default CURRENT_TIMESTAMP TIMESTAMP updated" json:"mtime"`
	}

	assert.NoError(t, prepareEngine())
	assertSync(t, new(PrepareTask))

	prepareTask := &PrepareTask{
		StartTime: JsonTime(time.Now()),
		Cuser:     "userId",
		Muser:     "userId",
	}
	cnt, err := testEngine.Omit("end_time").InsertOne(prepareTask)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)
}

type MyJsonTime struct {
	Id      int64    `json:"id"`
	Created JsonTime `xorm:"created" json:"created_at"`
}

func TestCreatedJsonTime(t *testing.T) {
	assert.NoError(t, prepareEngine())

	di5 := new(MyJsonTime)
	err := testEngine.Sync2(di5)
	if err != nil {
		t.Fatal(err)
	}
	ci5 := &MyJsonTime{}
	_, err = testEngine.Insert(ci5)
	if err != nil {
		t.Fatal(err)
	}
	has, err := testEngine.Desc("(id)").Get(di5)
	if err != nil {
		t.Fatal(err)
	}
	if !has {
		t.Fatal(ErrNotExist)
	}
	if time.Time(ci5.Created).Unix() != time.Time(di5.Created).Unix() {
		t.Fatal("should equal:", time.Time(ci5.Created).Unix(), time.Time(di5.Created).Unix())
	}
	fmt.Println("ci5:", ci5, "di5:", di5)

	var dis = make([]MyJsonTime, 0)
	err = testEngine.Find(&dis)
	assert.NoError(t, err)
}

func TestInsertMulti2(t *testing.T) {
	assert.NoError(t, prepareEngine())

	assertSync(t, new(Userinfo))

	users := []Userinfo{
		{Username: "xlw", Departname: "dev", Alias: "lunny2", Created: time.Now()},
		{Username: "xlw2", Departname: "dev", Alias: "lunny3", Created: time.Now()},
		{Username: "xlw11", Departname: "dev", Alias: "lunny2", Created: time.Now()},
		{Username: "xlw22", Departname: "dev", Alias: "lunny3", Created: time.Now()},
	}
	cnt, err := testEngine.Insert(&users)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	assert.EqualValues(t, len(users), cnt)

	users2 := []*Userinfo{
		{Username: "1xlw", Departname: "dev", Alias: "lunny2", Created: time.Now()},
		{Username: "1xlw2", Departname: "dev", Alias: "lunny3", Created: time.Now()},
		{Username: "1xlw11", Departname: "dev", Alias: "lunny2", Created: time.Now()},
		{Username: "1xlw22", Departname: "dev", Alias: "lunny3", Created: time.Now()},
	}

	cnt, err = testEngine.Insert(&users2)
	assert.NoError(t, err)
	assert.EqualValues(t, len(users2), cnt)
}

func TestInsertTwoTable(t *testing.T) {
	assert.NoError(t, prepareEngine())

	assertSync(t, new(Userinfo), new(Userdetail))

	userdetail := Userdetail{ /*Id: 1, */ Intro: "I'm a very beautiful women.", Profile: "sfsaf"}
	userinfo := Userinfo{Username: "xlw3", Departname: "dev", Alias: "lunny4", Created: time.Now(), Detail: userdetail}

	cnt, err := testEngine.Insert(&userinfo, &userdetail)
	if err != nil {
		t.Error(err)
		panic(err)
	}

	if userinfo.Uid <= 0 {
		err = errors.New("not return id error")
		t.Error(err)
		panic(err)
	}

	if userdetail.Id <= 0 {
		err = errors.New("not return id error")
		t.Error(err)
		panic(err)
	}

	if cnt != 2 {
		err = errors.New("insert not returned 2")
		t.Error(err)
		panic(err)
	}
}

func TestInsertCreatedInt64(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type TestCreatedInt64 struct {
		Id      int64  `xorm:"autoincr pk"`
		Msg     string `xorm:"varchar(255)"`
		Created int64  `xorm:"created"`
	}

	assert.NoError(t, testEngine.Sync2(new(TestCreatedInt64)))

	data := TestCreatedInt64{Msg: "hi"}
	now := time.Now()
	cnt, err := testEngine.Insert(&data)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)
	assert.True(t, now.Unix() <= data.Created)

	var data2 TestCreatedInt64
	has, err := testEngine.Get(&data2)
	assert.NoError(t, err)
	assert.True(t, has)

	assert.EqualValues(t, data.Created, data2.Created)
}

type MyUserinfo Userinfo

func (MyUserinfo) TableName() string {
	return "user_info"
}

func TestInsertMulti3(t *testing.T) {
	assert.NoError(t, prepareEngine())

	testEngine.ShowSQL(true)
	assertSync(t, new(MyUserinfo))

	users := []MyUserinfo{
		{Username: "xlw", Departname: "dev", Alias: "lunny2", Created: time.Now()},
		{Username: "xlw2", Departname: "dev", Alias: "lunny3", Created: time.Now()},
		{Username: "xlw11", Departname: "dev", Alias: "lunny2", Created: time.Now()},
		{Username: "xlw22", Departname: "dev", Alias: "lunny3", Created: time.Now()},
	}
	cnt, err := testEngine.Insert(&users)
	assert.NoError(t, err)
	assert.EqualValues(t, len(users), cnt)

	users2 := []*MyUserinfo{
		{Username: "1xlw", Departname: "dev", Alias: "lunny2", Created: time.Now()},
		{Username: "1xlw2", Departname: "dev", Alias: "lunny3", Created: time.Now()},
		{Username: "1xlw11", Departname: "dev", Alias: "lunny2", Created: time.Now()},
		{Username: "1xlw22", Departname: "dev", Alias: "lunny3", Created: time.Now()},
	}

	cnt, err = testEngine.Insert(&users2)
	assert.NoError(t, err)
	assert.EqualValues(t, len(users), cnt)
}

type MyUserinfo2 struct {
	Uid        int64  `xorm:"id pk not null autoincr"`
	Username   string `xorm:"unique"`
	Departname string
	Alias      string `xorm:"-"`
	Created    time.Time
	Detail     Userdetail `xorm:"detail_id int(11)"`
	Height     float64
	Avatar     []byte
	IsMan      bool
}

func (MyUserinfo2) TableName() string {
	return "user_info"
}

func TestInsertMulti4(t *testing.T) {
	assert.NoError(t, prepareEngine())

	testEngine.ShowSQL(false)
	assertSync(t, new(MyUserinfo2))
	testEngine.ShowSQL(true)

	users := []MyUserinfo2{
		{Username: "xlw", Departname: "dev", Alias: "lunny2", Created: time.Now()},
		{Username: "xlw2", Departname: "dev", Alias: "lunny3", Created: time.Now()},
		{Username: "xlw11", Departname: "dev", Alias: "lunny2", Created: time.Now()},
		{Username: "xlw22", Departname: "dev", Alias: "lunny3", Created: time.Now()},
	}
	cnt, err := testEngine.Insert(&users)
	assert.NoError(t, err)
	assert.EqualValues(t, len(users), cnt)

	users2 := []*MyUserinfo2{
		{Username: "1xlw", Departname: "dev", Alias: "lunny2", Created: time.Now()},
		{Username: "1xlw2", Departname: "dev", Alias: "lunny3", Created: time.Now()},
		{Username: "1xlw11", Departname: "dev", Alias: "lunny2", Created: time.Now()},
		{Username: "1xlw22", Departname: "dev", Alias: "lunny3", Created: time.Now()},
	}

	cnt, err = testEngine.Insert(&users2)
	assert.NoError(t, err)
	assert.EqualValues(t, len(users), cnt)
}

func TestAnonymousStruct(t *testing.T) {
	type PlainObject struct {
		ID   uint64 `json:"id,string" xorm:"'ID' pk autoincr"`
		Desc string `json:"desc" xorm:"'DESC' notnull"`
	}

	type PlainFoo struct {
		PlainObject `xorm:"extends"` // primary key defined in extends struct

		Width  uint32 `json:"width" xorm:"'WIDTH' notnull"`
		Height uint32 `json:"height" xorm:"'HEIGHT' notnull"`

		Ext struct {
			F1 uint32 `json:"f1,omitempty"`
			F2 uint32 `json:"f2,omitempty"`
		} `json:"ext" xorm:"'EXT' json notnull"`
	}

	assert.NoError(t, prepareEngine())
	assertSync(t, new(PlainFoo))

	_, err := testEngine.Insert(&PlainFoo{
		PlainObject: PlainObject{
			Desc: "test",
		},
		Width:  10,
		Height: 20,

		Ext: struct {
			F1 uint32 `json:"f1,omitempty"`
			F2 uint32 `json:"f2,omitempty"`
		}{
			F1: 11,
			F2: 12,
		},
	})
	assert.NoError(t, err)
}

func TestInsertMap(t *testing.T) {
	type InsertMap struct {
		Id     int64
		Width  uint32
		Height uint32
		Name   string
	}

	assert.NoError(t, prepareEngine())
	assertSync(t, new(InsertMap))

	cnt, err := testEngine.Table(new(InsertMap)).Insert(map[string]interface{}{
		"width":  20,
		"height": 10,
		"name":   "lunny",
	})
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	var im InsertMap
	has, err := testEngine.Get(&im)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, 20, im.Width)
	assert.EqualValues(t, 10, im.Height)
	assert.EqualValues(t, "lunny", im.Name)

	cnt, err = testEngine.Table("insert_map").Insert(map[string]interface{}{
		"width":  30,
		"height": 10,
		"name":   "lunny",
	})
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	var ims []InsertMap
	err = testEngine.Find(&ims)
	assert.NoError(t, err)
	assert.EqualValues(t, 2, len(ims))
	assert.EqualValues(t, 20, ims[0].Width)
	assert.EqualValues(t, 10, ims[0].Height)
	assert.EqualValues(t, "lunny", ims[0].Name)
	assert.EqualValues(t, 30, ims[1].Width)
	assert.EqualValues(t, 10, ims[1].Height)
	assert.EqualValues(t, "lunny", ims[1].Name)

	cnt, err = testEngine.Table("insert_map").Insert([]map[string]interface{}{
		{
			"width":  40,
			"height": 10,
			"name":   "lunny",
		},
		{
			"width":  50,
			"height": 10,
			"name":   "lunny",
		},
	})
	assert.NoError(t, err)
	assert.EqualValues(t, 2, cnt)

	ims = make([]InsertMap, 0, 4)
	err = testEngine.Find(&ims)
	assert.NoError(t, err)
	assert.EqualValues(t, 4, len(ims))
	assert.EqualValues(t, 20, ims[0].Width)
	assert.EqualValues(t, 10, ims[0].Height)
	assert.EqualValues(t, "lunny", ims[1].Name)
	assert.EqualValues(t, 30, ims[1].Width)
	assert.EqualValues(t, 10, ims[1].Height)
	assert.EqualValues(t, "lunny", ims[1].Name)
	assert.EqualValues(t, 40, ims[2].Width)
	assert.EqualValues(t, 10, ims[2].Height)
	assert.EqualValues(t, "lunny", ims[2].Name)
	assert.EqualValues(t, 50, ims[3].Width)
	assert.EqualValues(t, 10, ims[3].Height)
	assert.EqualValues(t, "lunny", ims[3].Name)
}

/*INSERT INTO `issue` (`repo_id`, `poster_id`, ... ,`name`, `content`, ... ,`index`)
SELECT $1, $2, ..., $14, $15, ..., MAX(`index`) + 1 FROM `issue` WHERE `repo_id` = $1;
*/
func TestInsertWhere(t *testing.T) {
	type InsertWhere struct {
		Id     int64
		Index  int   `xorm:"unique(s) notnull"`
		RepoId int64 `xorm:"unique(s)"`
		Width  uint32
		Height uint32
		Name   string
		IsTrue bool
	}

	assert.NoError(t, prepareEngine())
	assertSync(t, new(InsertWhere))

	var i = InsertWhere{
		RepoId: 1,
		Width:  10,
		Height: 20,
		Name:   "trest",
	}

	inserted, err := testEngine.SetExpr("`index`", "coalesce(MAX(`index`),0)+1").
		Where("repo_id=?", 1).
		Insert(&i)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, inserted)
	assert.EqualValues(t, 1, i.Id)

	var j InsertWhere
	has, err := testEngine.ID(i.Id).Get(&j)
	assert.NoError(t, err)
	assert.True(t, has)
	i.Index = 1
	assert.EqualValues(t, i, j)

	inserted, err = testEngine.Table(new(InsertWhere)).Where("repo_id=?", 1).
		SetExpr("`index`", "coalesce(MAX(`index`),0)+1").
		Insert(map[string]interface{}{
			"repo_id": 1,
			"width":   20,
			"height":  40,
			"name":    "trest2",
		})
	assert.NoError(t, err)
	assert.EqualValues(t, 1, inserted)

	var j2 InsertWhere
	has, err = testEngine.ID(2).Get(&j2)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, 1, j2.RepoId)
	assert.EqualValues(t, 20, j2.Width)
	assert.EqualValues(t, 40, j2.Height)
	assert.EqualValues(t, "trest2", j2.Name)
	assert.EqualValues(t, 2, j2.Index)

	inserted, err = testEngine.Table(new(InsertWhere)).Where("repo_id=?", 1).
		SetExpr("`index`", "coalesce(MAX(`index`),0)+1").
		SetExpr("repo_id", "1").
		Insert(map[string]string{
			"name": "trest3",
		})
	assert.NoError(t, err)
	assert.EqualValues(t, 1, inserted)

	var j3 InsertWhere
	has, err = testEngine.ID(3).Get(&j3)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, "trest3", j3.Name)
	assert.EqualValues(t, 3, j3.Index)

	inserted, err = testEngine.Table(new(InsertWhere)).Where("repo_id=?", 1).
		SetExpr("`index`", "coalesce(MAX(`index`),0)+1").
		Insert(map[string]interface{}{
			"repo_id": 1,
			"name":    "10';delete * from insert_where; --",
		})
	assert.NoError(t, err)
	assert.EqualValues(t, 1, inserted)

	var j4 InsertWhere
	has, err = testEngine.ID(4).Get(&j4)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, "10';delete * from insert_where; --", j4.Name)
	assert.EqualValues(t, 4, j4.Index)

	inserted, err = testEngine.Table(new(InsertWhere)).Where("repo_id=?", 1).
		SetExpr("`index`", "coalesce(MAX(`index`),0)+1").
		Insert(map[string]interface{}{
			"repo_id": 1,
			"name":    "10\\';delete * from insert_where; --",
		})
	assert.NoError(t, err)
	assert.EqualValues(t, 1, inserted)

	var j5 InsertWhere
	has, err = testEngine.ID(5).Get(&j5)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, "10\\';delete * from insert_where; --", j5.Name)
	assert.EqualValues(t, 5, j5.Index)
}

func TestInsertExpr2(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type InsertExprsRelease struct {
		Id         int64
		RepoId     int
		IsTag      bool
		IsDraft    bool
		NumCommits int
		Sha1       string
	}

	assertSync(t, new(InsertExprsRelease))

	var ie = InsertExprsRelease{
		RepoId: 1,
		IsTag:  true,
	}
	inserted, err := testEngine.
		SetExpr("is_draft", true).
		SetExpr("num_commits", 0).
		SetExpr("sha1", "").
		Insert(&ie)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, inserted)

	var ie2 InsertExprsRelease
	has, err := testEngine.ID(ie.Id).Get(&ie2)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, true, ie2.IsDraft)
	assert.EqualValues(t, "", ie2.Sha1)
	assert.EqualValues(t, 0, ie2.NumCommits)
	assert.EqualValues(t, 1, ie2.RepoId)
	assert.EqualValues(t, true, ie2.IsTag)

	inserted, err = testEngine.Table(new(InsertExprsRelease)).
		SetExpr("is_draft", true).
		SetExpr("num_commits", 0).
		SetExpr("sha1", "").
		Insert(map[string]interface{}{
			"repo_id": 1,
			"is_tag":  true,
		})
	assert.NoError(t, err)
	assert.EqualValues(t, 1, inserted)

	var ie3 InsertExprsRelease
	has, err = testEngine.ID(ie.Id + 1).Get(&ie3)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, true, ie3.IsDraft)
	assert.EqualValues(t, "", ie3.Sha1)
	assert.EqualValues(t, 0, ie3.NumCommits)
	assert.EqualValues(t, 1, ie3.RepoId)
	assert.EqualValues(t, true, ie3.IsTag)
}

type NightlyRate struct {
	ID int64 `xorm:"'id' not null pk BIGINT(20)" json:"id"`
}

func (NightlyRate) TableName() string {
	return "prd_nightly_rate"
}

func TestMultipleInsertTableName(t *testing.T) {
	assert.NoError(t, prepareEngine())

	tableName := `prd_nightly_rate_16`
	assert.NoError(t, testEngine.Table(tableName).Sync2(new(NightlyRate)))

	trans := testEngine.NewSession()
	defer trans.Close()
	err := trans.Begin()
	assert.NoError(t, err)

	rtArr := []interface{}{
		[]*NightlyRate{
			{ID: 1},
			{ID: 2},
		},
		[]*NightlyRate{
			{ID: 3},
			{ID: 4},
		},
		[]*NightlyRate{
			{ID: 5},
		},
	}

	_, err = trans.Table(tableName).Insert(rtArr...)
	assert.NoError(t, err)

	assert.NoError(t, trans.Commit())
}

func TestInsertMultiWithOmit(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type TestMultiOmit struct {
		Id      int64  `xorm:"int(11) pk"`
		Name    string `xorm:"varchar(255)"`
		Omitted string `xorm:"varchar(255) 'omitted'"`
	}

	assert.NoError(t, testEngine.Sync2(new(TestMultiOmit)))

	l := []interface{}{
		TestMultiOmit{Id: 1, Name: "1", Omitted: "1"},
		TestMultiOmit{Id: 2, Name: "1", Omitted: "2"},
		TestMultiOmit{Id: 3, Name: "1", Omitted: "3"},
	}

	check := func() {
		var ls []TestMultiOmit
		err := testEngine.Find(&ls)
		assert.NoError(t, err)
		assert.EqualValues(t, 3, len(ls))

		for e := range ls {
			assert.EqualValues(t, "", ls[e].Omitted)
		}
	}

	num, err := testEngine.Omit("omitted").Insert(l...)
	assert.NoError(t, err)
	assert.EqualValues(t, 3, num)
	check()

	num, err = testEngine.Delete(TestMultiOmit{Name: "1"})
	assert.NoError(t, err)
	assert.EqualValues(t, 3, num)

	num, err = testEngine.Omit("omitted").Insert(l)
	assert.NoError(t, err)
	assert.EqualValues(t, 3, num)
	check()
}

func TestInsertTwice(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type InsertStructA struct {
		FieldA int
	}

	type InsertStructB struct {
		FieldB int
	}

	assert.NoError(t, testEngine.Sync2(new(InsertStructA), new(InsertStructB)))

	var sliceA []InsertStructA // sliceA is empty
	sliceB := []InsertStructB{
		{
			FieldB: 1,
		},
	}

	ssn := testEngine.NewSession()
	defer ssn.Close()

	err := ssn.Begin()
	assert.NoError(t, err)

	_, err = ssn.Insert(sliceA)
	assert.EqualValues(t, ErrNoElementsOnSlice, err)

	_, err = ssn.Insert(sliceB)
	assert.NoError(t, err)

	assert.NoError(t, ssn.Commit())
}
