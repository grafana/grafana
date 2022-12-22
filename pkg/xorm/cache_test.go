// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestCacheFind(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type MailBox struct {
		Id       int64 `xorm:"pk"`
		Username string
		Password string
	}

	oldCacher := testEngine.GetDefaultCacher()
	cacher := NewLRUCacher2(NewMemoryStore(), time.Hour, 10000)
	testEngine.SetDefaultCacher(cacher)

	assert.NoError(t, testEngine.Sync2(new(MailBox)))

	var inserts = []*MailBox{
		{
			Id:       0,
			Username: "user1",
			Password: "pass1",
		},
		{
			Id:       1,
			Username: "user2",
			Password: "pass2",
		},
	}
	_, err := testEngine.Insert(inserts[0], inserts[1])
	assert.NoError(t, err)

	var boxes []MailBox
	assert.NoError(t, testEngine.Find(&boxes))
	assert.EqualValues(t, 2, len(boxes))
	for i, box := range boxes {
		assert.Equal(t, inserts[i].Id, box.Id)
		assert.Equal(t, inserts[i].Username, box.Username)
		assert.Equal(t, inserts[i].Password, box.Password)
	}

	boxes = make([]MailBox, 0, 2)
	assert.NoError(t, testEngine.Find(&boxes))
	assert.EqualValues(t, 2, len(boxes))
	for i, box := range boxes {
		assert.Equal(t, inserts[i].Id, box.Id)
		assert.Equal(t, inserts[i].Username, box.Username)
		assert.Equal(t, inserts[i].Password, box.Password)
	}

	boxes = make([]MailBox, 0, 2)
	assert.NoError(t, testEngine.Alias("a").Where("a.id > -1").Asc("a.id").Find(&boxes))
	assert.EqualValues(t, 2, len(boxes))
	for i, box := range boxes {
		assert.Equal(t, inserts[i].Id, box.Id)
		assert.Equal(t, inserts[i].Username, box.Username)
		assert.Equal(t, inserts[i].Password, box.Password)
	}

	type MailBox4 struct {
		Id       int64
		Username string
		Password string
	}

	boxes2 := make([]MailBox4, 0, 2)
	assert.NoError(t, testEngine.Table("mail_box").Where("mail_box.id > -1").Asc("mail_box.id").Find(&boxes2))
	assert.EqualValues(t, 2, len(boxes2))
	for i, box := range boxes2 {
		assert.Equal(t, inserts[i].Id, box.Id)
		assert.Equal(t, inserts[i].Username, box.Username)
		assert.Equal(t, inserts[i].Password, box.Password)
	}

	testEngine.SetDefaultCacher(oldCacher)
}

func TestCacheFind2(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type MailBox2 struct {
		Id       uint64 `xorm:"pk"`
		Username string
		Password string
	}

	oldCacher := testEngine.GetDefaultCacher()
	cacher := NewLRUCacher2(NewMemoryStore(), time.Hour, 10000)
	testEngine.SetDefaultCacher(cacher)

	assert.NoError(t, testEngine.Sync2(new(MailBox2)))

	var inserts = []*MailBox2{
		{
			Id:       0,
			Username: "user1",
			Password: "pass1",
		},
		{
			Id:       1,
			Username: "user2",
			Password: "pass2",
		},
	}
	_, err := testEngine.Insert(inserts[0], inserts[1])
	assert.NoError(t, err)

	var boxes []MailBox2
	assert.NoError(t, testEngine.Find(&boxes))
	assert.EqualValues(t, 2, len(boxes))
	for i, box := range boxes {
		assert.Equal(t, inserts[i].Id, box.Id)
		assert.Equal(t, inserts[i].Username, box.Username)
		assert.Equal(t, inserts[i].Password, box.Password)
	}

	boxes = make([]MailBox2, 0, 2)
	assert.NoError(t, testEngine.Find(&boxes))
	assert.EqualValues(t, 2, len(boxes))
	for i, box := range boxes {
		assert.Equal(t, inserts[i].Id, box.Id)
		assert.Equal(t, inserts[i].Username, box.Username)
		assert.Equal(t, inserts[i].Password, box.Password)
	}

	testEngine.SetDefaultCacher(oldCacher)
}

func TestCacheGet(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type MailBox3 struct {
		Id       uint64
		Username string
		Password string
	}

	oldCacher := testEngine.GetDefaultCacher()
	cacher := NewLRUCacher2(NewMemoryStore(), time.Hour, 10000)
	testEngine.SetDefaultCacher(cacher)

	assert.NoError(t, testEngine.Sync2(new(MailBox3)))

	var inserts = []*MailBox3{
		{
			Username: "user1",
			Password: "pass1",
		},
	}
	_, err := testEngine.Insert(inserts[0])
	assert.NoError(t, err)

	var box1 MailBox3
	has, err := testEngine.Where("id = ?", inserts[0].Id).Get(&box1)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, "user1", box1.Username)
	assert.EqualValues(t, "pass1", box1.Password)

	var box2 MailBox3
	has, err = testEngine.Where("id = ?", inserts[0].Id).Get(&box2)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, "user1", box2.Username)
	assert.EqualValues(t, "pass1", box2.Password)

	testEngine.SetDefaultCacher(oldCacher)
}
