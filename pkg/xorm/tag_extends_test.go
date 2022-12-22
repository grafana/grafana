// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

type tempUser struct {
	Id       int64
	Username string
}

type tempUser2 struct {
	TempUser   tempUser `xorm:"extends"`
	Departname string
}

type tempUser3 struct {
	Temp       *tempUser `xorm:"extends"`
	Departname string
}

type tempUser4 struct {
	TempUser2 tempUser2 `xorm:"extends"`
}

type Userinfo struct {
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

type Userdetail struct {
	Id      int64
	Intro   string `xorm:"text"`
	Profile string `xorm:"varchar(2000)"`
}

type UserAndDetail struct {
	Userinfo   `xorm:"extends"`
	Userdetail `xorm:"extends"`
}

func TestExtends(t *testing.T) {
	assert.NoError(t, prepareEngine())

	err := testEngine.DropTables(&tempUser2{})
	assert.NoError(t, err)

	err = testEngine.CreateTables(&tempUser2{})
	assert.NoError(t, err)

	tu := &tempUser2{tempUser{0, "extends"}, "dev depart"}
	_, err = testEngine.Insert(tu)
	assert.NoError(t, err)

	tu2 := &tempUser2{}
	_, err = testEngine.Get(tu2)
	assert.NoError(t, err)

	tu3 := &tempUser2{tempUser{0, "extends update"}, ""}
	_, err = testEngine.ID(tu2.TempUser.Id).Update(tu3)
	assert.NoError(t, err)

	err = testEngine.DropTables(&tempUser4{})
	assert.NoError(t, err)

	err = testEngine.CreateTables(&tempUser4{})
	assert.NoError(t, err)

	tu8 := &tempUser4{tempUser2{tempUser{0, "extends"}, "dev depart"}}
	_, err = testEngine.Insert(tu8)
	assert.NoError(t, err)

	tu9 := &tempUser4{}
	_, err = testEngine.Get(tu9)
	assert.NoError(t, err)

	if tu9.TempUser2.TempUser.Username != tu8.TempUser2.TempUser.Username || tu9.TempUser2.Departname != tu8.TempUser2.Departname {
		err = errors.New(fmt.Sprintln("not equal for", tu8, tu9))
		t.Error(err)
		panic(err)
	}

	tu10 := &tempUser4{tempUser2{tempUser{0, "extends update"}, ""}}
	_, err = testEngine.ID(tu9.TempUser2.TempUser.Id).Update(tu10)
	assert.NoError(t, err)

	err = testEngine.DropTables(&tempUser3{})
	assert.NoError(t, err)

	err = testEngine.CreateTables(&tempUser3{})
	assert.NoError(t, err)

	tu4 := &tempUser3{&tempUser{0, "extends"}, "dev depart"}
	_, err = testEngine.Insert(tu4)
	assert.NoError(t, err)

	tu5 := &tempUser3{}
	_, err = testEngine.Get(tu5)
	assert.NoError(t, err)

	if tu5.Temp == nil {
		err = errors.New("error get data extends")
		t.Error(err)
		panic(err)
	}
	if tu5.Temp.Id != 1 || tu5.Temp.Username != "extends" ||
		tu5.Departname != "dev depart" {
		err = errors.New("error get data extends")
		t.Error(err)
		panic(err)
	}

	tu6 := &tempUser3{&tempUser{0, "extends update"}, ""}
	_, err = testEngine.ID(tu5.Temp.Id).Update(tu6)
	assert.NoError(t, err)

	users := make([]tempUser3, 0)
	err = testEngine.Find(&users)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, len(users), "error get data not 1")

	assertSync(t, new(Userinfo), new(Userdetail))

	detail := Userdetail{
		Intro: "I'm in China",
	}
	_, err = testEngine.Insert(&detail)
	assert.NoError(t, err)

	_, err = testEngine.Insert(&Userinfo{
		Username: "lunny",
		Detail:   detail,
	})
	assert.NoError(t, err)

	var info UserAndDetail
	qt := testEngine.Quote
	ui := testEngine.TableName(new(Userinfo), true)
	ud := testEngine.TableName(&detail, true)
	uiid := testEngine.GetColumnMapper().Obj2Table("Id")
	udid := "detail_id"
	sql := fmt.Sprintf("select * from %s, %s where %s.%s = %s.%s",
		qt(ui), qt(ud), qt(ui), qt(udid), qt(ud), qt(uiid))
	b, err := testEngine.SQL(sql).NoCascade().Get(&info)
	assert.NoError(t, err)
	if !b {
		err = errors.New("should has lest one record")
		t.Error(err)
		panic(err)
	}
	fmt.Println(info)
	if info.Userinfo.Uid == 0 || info.Userdetail.Id == 0 {
		err = errors.New("all of the id should has value")
		t.Error(err)
		panic(err)
	}

	fmt.Println("----join--info2")
	var info2 UserAndDetail
	b, err = testEngine.Table(&Userinfo{}).
		Join("LEFT", qt(ud), qt(ui)+"."+qt("detail_id")+" = "+qt(ud)+"."+qt(uiid)).
		NoCascade().Get(&info2)
	if err != nil {
		t.Error(err)
		panic(err)
	}
	if !b {
		err = errors.New("should has lest one record")
		t.Error(err)
		panic(err)
	}
	if info2.Userinfo.Uid == 0 || info2.Userdetail.Id == 0 {
		err = errors.New("all of the id should has value")
		t.Error(err)
		panic(err)
	}
	fmt.Println(info2)

	fmt.Println("----join--infos2")
	var infos2 = make([]UserAndDetail, 0)
	err = testEngine.Table(&Userinfo{}).
		Join("LEFT", qt(ud), qt(ui)+"."+qt("detail_id")+" = "+qt(ud)+"."+qt(uiid)).
		NoCascade().
		Find(&infos2)
	assert.NoError(t, err)
	fmt.Println(infos2)
}

type MessageBase struct {
	Id     int64 `xorm:"int(11) pk autoincr"`
	TypeId int64 `xorm:"int(11) notnull"`
}

type Message struct {
	MessageBase `xorm:"extends"`
	Title       string    `xorm:"varchar(100) notnull"`
	Content     string    `xorm:"text notnull"`
	Uid         int64     `xorm:"int(11) notnull"`
	ToUid       int64     `xorm:"int(11) notnull"`
	CreateTime  time.Time `xorm:"datetime notnull created"`
}

type MessageUser struct {
	Id   int64
	Name string
}

type MessageType struct {
	Id   int64
	Name string
}

type MessageExtend3 struct {
	Message  `xorm:"extends"`
	Sender   MessageUser `xorm:"extends"`
	Receiver MessageUser `xorm:"extends"`
	Type     MessageType `xorm:"extends"`
}

type MessageExtend4 struct {
	Message     `xorm:"extends"`
	MessageUser `xorm:"extends"`
	MessageType `xorm:"extends"`
}

func TestExtends2(t *testing.T) {
	assert.NoError(t, prepareEngine())

	err := testEngine.DropTables(&Message{}, &MessageUser{}, &MessageType{})
	assert.NoError(t, err)

	err = testEngine.CreateTables(&Message{}, &MessageUser{}, &MessageType{})
	assert.NoError(t, err)

	var sender = MessageUser{Name: "sender"}
	var receiver = MessageUser{Name: "receiver"}
	var msgtype = MessageType{Name: "type"}
	_, err = testEngine.Insert(&sender, &receiver, &msgtype)
	assert.NoError(t, err)

	msg := Message{
		MessageBase: MessageBase{
			Id: msgtype.Id,
		},
		Title:   "test",
		Content: "test",
		Uid:     sender.Id,
		ToUid:   receiver.Id,
	}

	session := testEngine.NewSession()
	defer session.Close()

	cnt, err := session.Insert(&msg)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	var mapper = testEngine.GetTableMapper().Obj2Table
	var quote = testEngine.Quote
	userTableName := quote(testEngine.TableName(mapper("MessageUser"), true))
	typeTableName := quote(testEngine.TableName(mapper("MessageType"), true))
	msgTableName := quote(testEngine.TableName(mapper("Message"), true))

	list := make([]Message, 0)
	err = session.Table(msgTableName).Join("LEFT", []string{userTableName, "sender"}, "`sender`.`"+mapper("Id")+"`="+msgTableName+".`"+mapper("Uid")+"`").
		Join("LEFT", []string{userTableName, "receiver"}, "`receiver`.`"+mapper("Id")+"`="+msgTableName+".`"+mapper("ToUid")+"`").
		Join("LEFT", []string{typeTableName, "type"}, "`type`.`"+mapper("Id")+"`="+msgTableName+".`"+mapper("Id")+"`").
		Find(&list)
	assert.NoError(t, err)

	assert.EqualValues(t, 1, len(list), fmt.Sprintln("should have 1 message, got", len(list)))
	assert.EqualValues(t, msg.Id, list[0].Id, fmt.Sprintln("should message equal", list[0], msg))
}

func TestExtends3(t *testing.T) {
	assert.NoError(t, prepareEngine())

	err := testEngine.DropTables(&Message{}, &MessageUser{}, &MessageType{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	err = testEngine.CreateTables(&Message{}, &MessageUser{}, &MessageType{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	var sender = MessageUser{Name: "sender"}
	var receiver = MessageUser{Name: "receiver"}
	var msgtype = MessageType{Name: "type"}
	_, err = testEngine.Insert(&sender, &receiver, &msgtype)
	if err != nil {
		t.Error(err)
		panic(err)
	}

	msg := Message{
		MessageBase: MessageBase{
			Id: msgtype.Id,
		},
		Title:   "test",
		Content: "test",
		Uid:     sender.Id,
		ToUid:   receiver.Id,
	}

	session := testEngine.NewSession()
	defer session.Close()

	_, err = session.Insert(&msg)
	assert.NoError(t, err)

	var mapper = testEngine.GetTableMapper().Obj2Table
	var quote = testEngine.Quote
	userTableName := quote(testEngine.TableName(mapper("MessageUser"), true))
	typeTableName := quote(testEngine.TableName(mapper("MessageType"), true))
	msgTableName := quote(testEngine.TableName(mapper("Message"), true))

	list := make([]MessageExtend3, 0)
	err = session.Table(msgTableName).Join("LEFT", []string{userTableName, "sender"}, "`sender`.`"+mapper("Id")+"`="+msgTableName+".`"+mapper("Uid")+"`").
		Join("LEFT", []string{userTableName, "receiver"}, "`receiver`.`"+mapper("Id")+"`="+msgTableName+".`"+mapper("ToUid")+"`").
		Join("LEFT", []string{typeTableName, "type"}, "`type`.`"+mapper("Id")+"`="+msgTableName+".`"+mapper("Id")+"`").
		Find(&list)
	assert.NoError(t, err)

	if len(list) != 1 {
		err = errors.New(fmt.Sprintln("should have 1 message, got", len(list)))
		t.Error(err)
		panic(err)
	}

	if list[0].Message.Id != msg.Id {
		err = errors.New(fmt.Sprintln("should message equal", list[0].Message, msg))
		t.Error(err)
		panic(err)
	}

	if list[0].Sender.Id != sender.Id || list[0].Sender.Name != sender.Name {
		err = errors.New(fmt.Sprintln("should sender equal", list[0].Sender, sender))
		t.Error(err)
		panic(err)
	}

	if list[0].Receiver.Id != receiver.Id || list[0].Receiver.Name != receiver.Name {
		err = errors.New(fmt.Sprintln("should receiver equal", list[0].Receiver, receiver))
		t.Error(err)
		panic(err)
	}

	if list[0].Type.Id != msgtype.Id || list[0].Type.Name != msgtype.Name {
		err = errors.New(fmt.Sprintln("should msgtype equal", list[0].Type, msgtype))
		t.Error(err)
		panic(err)
	}
}

func TestExtends4(t *testing.T) {
	assert.NoError(t, prepareEngine())

	err := testEngine.DropTables(&Message{}, &MessageUser{}, &MessageType{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	err = testEngine.CreateTables(&Message{}, &MessageUser{}, &MessageType{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	var sender = MessageUser{Name: "sender"}
	var msgtype = MessageType{Name: "type"}
	_, err = testEngine.Insert(&sender, &msgtype)
	if err != nil {
		t.Error(err)
		panic(err)
	}

	msg := Message{
		MessageBase: MessageBase{
			Id: msgtype.Id,
		},
		Title:   "test",
		Content: "test",
		Uid:     sender.Id,
	}

	session := testEngine.NewSession()
	defer session.Close()

	_, err = session.Insert(&msg)
	assert.NoError(t, err)

	var mapper = testEngine.GetTableMapper().Obj2Table
	var quote = testEngine.Quote
	userTableName := quote(testEngine.TableName(mapper("MessageUser"), true))
	typeTableName := quote(testEngine.TableName(mapper("MessageType"), true))
	msgTableName := quote(testEngine.TableName(mapper("Message"), true))

	list := make([]MessageExtend4, 0)
	err = session.Table(msgTableName).Join("LEFT", userTableName, userTableName+".`"+mapper("Id")+"`="+msgTableName+".`"+mapper("Uid")+"`").
		Join("LEFT", typeTableName, typeTableName+".`"+mapper("Id")+"`="+msgTableName+".`"+mapper("Id")+"`").
		Find(&list)
	if err != nil {
		t.Error(err)
		panic(err)
	}

	if len(list) != 1 {
		err = errors.New(fmt.Sprintln("should have 1 message, got", len(list)))
		t.Error(err)
		panic(err)
	}

	if list[0].Message.Id != msg.Id {
		err = errors.New(fmt.Sprintln("should message equal", list[0].Message, msg))
		t.Error(err)
		panic(err)
	}

	if list[0].MessageUser.Id != sender.Id || list[0].MessageUser.Name != sender.Name {
		err = errors.New(fmt.Sprintln("should sender equal", list[0].MessageUser, sender))
		t.Error(err)
		panic(err)
	}

	if list[0].MessageType.Id != msgtype.Id || list[0].MessageType.Name != msgtype.Name {
		err = errors.New(fmt.Sprintln("should msgtype equal", list[0].MessageType, msgtype))
		t.Error(err)
		panic(err)
	}
}

type Size struct {
	ID     int64   `xorm:"int(4) 'id' pk autoincr"`
	Width  float32 `json:"width" xorm:"float 'Width'"`
	Height float32 `json:"height" xorm:"float 'Height'"`
}

type Book struct {
	ID         int64 `xorm:"int(4) 'id' pk autoincr"`
	SizeOpen   *Size `xorm:"extends('Open')"`
	SizeClosed *Size `xorm:"extends('Closed')"`
	Size       *Size `xorm:"extends('')"`
}

func TestExtends5(t *testing.T) {
	assert.NoError(t, prepareEngine())
	err := testEngine.DropTables(&Book{}, &Size{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	err = testEngine.CreateTables(&Size{}, &Book{})
	if err != nil {
		t.Error(err)
		panic(err)
	}

	var sc = Size{Width: 0.2, Height: 0.4}
	var so = Size{Width: 0.2, Height: 0.8}
	var s = Size{Width: 0.15, Height: 1.5}
	var bk1 = Book{
		SizeOpen:   &so,
		SizeClosed: &sc,
		Size:       &s,
	}
	var bk2 = Book{
		SizeOpen: &so,
	}
	var bk3 = Book{
		SizeClosed: &sc,
		Size:       &s,
	}
	var bk4 = Book{}
	var bk5 = Book{Size: &s}
	_, err = testEngine.Insert(&sc, &so, &s, &bk1, &bk2, &bk3, &bk4, &bk5)
	if err != nil {
		t.Fatal(err)
	}

	var books = map[int64]Book{
		bk1.ID: bk1,
		bk2.ID: bk2,
		bk3.ID: bk3,
		bk4.ID: bk4,
		bk5.ID: bk5,
	}

	session := testEngine.NewSession()
	defer session.Close()

	var mapper = testEngine.GetTableMapper().Obj2Table
	var quote = testEngine.Quote
	bookTableName := quote(testEngine.TableName(mapper("Book"), true))
	sizeTableName := quote(testEngine.TableName(mapper("Size"), true))

	list := make([]Book, 0)
	err = session.
		Select(fmt.Sprintf(
			"%s.%s, sc.%s AS %s, sc.%s AS %s, s.%s, s.%s",
			quote(bookTableName),
			quote("id"),
			quote("Width"),
			quote("ClosedWidth"),
			quote("Height"),
			quote("ClosedHeight"),
			quote("Width"),
			quote("Height"),
		)).
		Table(bookTableName).
		Join(
			"LEFT",
			sizeTableName+" AS `sc`",
			bookTableName+".`SizeClosed`=sc.`id`",
		).
		Join(
			"LEFT",
			sizeTableName+" AS `s`",
			bookTableName+".`Size`=s.`id`",
		).
		Find(&list)
	if err != nil {
		t.Error(err)
		panic(err)
	}

	for _, book := range list {
		if ok := assert.Equal(t, books[book.ID].SizeClosed.Width, book.SizeClosed.Width); !ok {
			t.Error("Not bounded size closed")
			panic("Not bounded size closed")
		}

		if ok := assert.Equal(t, books[book.ID].SizeClosed.Height, book.SizeClosed.Height); !ok {
			t.Error("Not bounded size closed")
			panic("Not bounded size closed")
		}

		if books[book.ID].Size != nil || book.Size != nil {
			if ok := assert.Equal(t, books[book.ID].Size.Width, book.Size.Width); !ok {
				t.Error("Not bounded size")
				panic("Not bounded size")
			}

			if ok := assert.Equal(t, books[book.ID].Size.Height, book.Size.Height); !ok {
				t.Error("Not bounded size")
				panic("Not bounded size")
			}
		}
	}
}
