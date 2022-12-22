// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestTimeUserTime(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type TimeUser struct {
		Id       string
		OperTime time.Time
	}

	assertSync(t, new(TimeUser))

	var user = TimeUser{
		Id:       "lunny",
		OperTime: time.Now(),
	}

	fmt.Println("user", user.OperTime)

	cnt, err := testEngine.Insert(&user)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	var user2 TimeUser
	has, err := testEngine.Get(&user2)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, user.OperTime.Unix(), user2.OperTime.Unix())
	assert.EqualValues(t, formatTime(user.OperTime), formatTime(user2.OperTime))
	fmt.Println("user2", user2.OperTime)
}

func TestTimeUserTimeDiffLoc(t *testing.T) {
	assert.NoError(t, prepareEngine())
	loc, err := time.LoadLocation("Asia/Shanghai")
	assert.NoError(t, err)
	testEngine.SetTZLocation(loc)
	dbLoc, err := time.LoadLocation("America/New_York")
	assert.NoError(t, err)
	testEngine.SetTZDatabase(dbLoc)

	type TimeUser2 struct {
		Id       string
		OperTime time.Time
	}

	assertSync(t, new(TimeUser2))

	var user = TimeUser2{
		Id:       "lunny",
		OperTime: time.Now(),
	}

	fmt.Println("user", user.OperTime)

	cnt, err := testEngine.Insert(&user)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	var user2 TimeUser2
	has, err := testEngine.Get(&user2)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, user.OperTime.Unix(), user2.OperTime.Unix())
	assert.EqualValues(t, formatTime(user.OperTime.In(loc)), formatTime(user2.OperTime))
	fmt.Println("user2", user2.OperTime)
}

func TestTimeUserCreated(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type UserCreated struct {
		Id        string
		CreatedAt time.Time `xorm:"created"`
	}

	assertSync(t, new(UserCreated))

	var user = UserCreated{
		Id: "lunny",
	}

	fmt.Println("user", user.CreatedAt)

	cnt, err := testEngine.Insert(&user)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	var user2 UserCreated
	has, err := testEngine.Get(&user2)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, user.CreatedAt.Unix(), user2.CreatedAt.Unix())
	assert.EqualValues(t, formatTime(user.CreatedAt), formatTime(user2.CreatedAt))
	fmt.Println("user2", user2.CreatedAt)
}

func TestTimeUserCreatedDiffLoc(t *testing.T) {
	assert.NoError(t, prepareEngine())
	loc, err := time.LoadLocation("Asia/Shanghai")
	assert.NoError(t, err)
	testEngine.SetTZLocation(loc)
	dbLoc, err := time.LoadLocation("America/New_York")
	assert.NoError(t, err)
	testEngine.SetTZDatabase(dbLoc)

	type UserCreated2 struct {
		Id        string
		CreatedAt time.Time `xorm:"created"`
	}

	assertSync(t, new(UserCreated2))

	var user = UserCreated2{
		Id: "lunny",
	}

	fmt.Println("user", user.CreatedAt)

	cnt, err := testEngine.Insert(&user)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	var user2 UserCreated2
	has, err := testEngine.Get(&user2)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, user.CreatedAt.Unix(), user2.CreatedAt.Unix())
	assert.EqualValues(t, formatTime(user.CreatedAt), formatTime(user2.CreatedAt))
	fmt.Println("user2", user2.CreatedAt)
}

func TestTimeUserUpdated(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type UserUpdated struct {
		Id        string
		CreatedAt time.Time `xorm:"created"`
		UpdatedAt time.Time `xorm:"updated"`
	}

	assertSync(t, new(UserUpdated))

	var user = UserUpdated{
		Id: "lunny",
	}

	fmt.Println("user", user.CreatedAt, user.UpdatedAt)

	cnt, err := testEngine.Insert(&user)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	var user2 UserUpdated
	has, err := testEngine.Get(&user2)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, user.CreatedAt.Unix(), user2.CreatedAt.Unix())
	assert.EqualValues(t, formatTime(user.CreatedAt), formatTime(user2.CreatedAt))
	assert.EqualValues(t, user.UpdatedAt.Unix(), user2.UpdatedAt.Unix())
	assert.EqualValues(t, formatTime(user.UpdatedAt), formatTime(user2.UpdatedAt))
	fmt.Println("user2", user2.CreatedAt, user2.UpdatedAt)

	var user3 = UserUpdated{
		Id: "lunny2",
	}

	cnt, err = testEngine.Update(&user3)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)
	assert.True(t, user.UpdatedAt.Unix() <= user3.UpdatedAt.Unix())

	var user4 UserUpdated
	has, err = testEngine.Get(&user4)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, user.CreatedAt.Unix(), user4.CreatedAt.Unix())
	assert.EqualValues(t, formatTime(user.CreatedAt), formatTime(user4.CreatedAt))
	assert.EqualValues(t, user3.UpdatedAt.Unix(), user4.UpdatedAt.Unix())
	assert.EqualValues(t, formatTime(user3.UpdatedAt), formatTime(user4.UpdatedAt))
	fmt.Println("user3", user.CreatedAt, user4.UpdatedAt)
}

func TestTimeUserUpdatedDiffLoc(t *testing.T) {
	assert.NoError(t, prepareEngine())
	loc, err := time.LoadLocation("Asia/Shanghai")
	assert.NoError(t, err)
	testEngine.SetTZLocation(loc)
	dbLoc, err := time.LoadLocation("America/New_York")
	assert.NoError(t, err)
	testEngine.SetTZDatabase(dbLoc)

	type UserUpdated2 struct {
		Id        string
		CreatedAt time.Time `xorm:"created"`
		UpdatedAt time.Time `xorm:"updated"`
	}

	assertSync(t, new(UserUpdated2))

	var user = UserUpdated2{
		Id: "lunny",
	}

	fmt.Println("user", user.CreatedAt, user.UpdatedAt)

	cnt, err := testEngine.Insert(&user)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	var user2 UserUpdated2
	has, err := testEngine.Get(&user2)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, user.CreatedAt.Unix(), user2.CreatedAt.Unix())
	assert.EqualValues(t, formatTime(user.CreatedAt), formatTime(user2.CreatedAt))
	assert.EqualValues(t, user.UpdatedAt.Unix(), user2.UpdatedAt.Unix())
	assert.EqualValues(t, formatTime(user.UpdatedAt), formatTime(user2.UpdatedAt))
	fmt.Println("user2", user2.CreatedAt, user2.UpdatedAt)

	var user3 = UserUpdated2{
		Id: "lunny2",
	}

	cnt, err = testEngine.Update(&user3)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)
	assert.True(t, user.UpdatedAt.Unix() <= user3.UpdatedAt.Unix())

	var user4 UserUpdated2
	has, err = testEngine.Get(&user4)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, user.CreatedAt.Unix(), user4.CreatedAt.Unix())
	assert.EqualValues(t, formatTime(user.CreatedAt), formatTime(user4.CreatedAt))
	assert.EqualValues(t, user3.UpdatedAt.Unix(), user4.UpdatedAt.Unix())
	assert.EqualValues(t, formatTime(user3.UpdatedAt), formatTime(user4.UpdatedAt))
	fmt.Println("user3", user.CreatedAt, user4.UpdatedAt)
}

func TestTimeUserDeleted(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type UserDeleted struct {
		Id           string
		CreatedAt    time.Time `xorm:"created"`
		UpdatedAt    time.Time `xorm:"updated"`
		DeletedAt    time.Time `xorm:"deleted"`
		CreatedAtStr string    `xorm:"datetime created"`
		UpdatedAtStr string    `xorm:"datetime updated"`
	}

	assertSync(t, new(UserDeleted))

	var user = UserDeleted{
		Id: "lunny",
	}

	cnt, err := testEngine.Insert(&user)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)
	fmt.Println("user", user.CreatedAt, user.UpdatedAt, user.DeletedAt)

	var user2 UserDeleted
	has, err := testEngine.Get(&user2)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, user.CreatedAt.Unix(), user2.CreatedAt.Unix())
	assert.EqualValues(t, formatTime(user.CreatedAt), formatTime(user2.CreatedAt))
	assert.EqualValues(t, user.UpdatedAt.Unix(), user2.UpdatedAt.Unix())
	assert.EqualValues(t, formatTime(user.UpdatedAt), formatTime(user2.UpdatedAt))
	assert.True(t, isTimeZero(user2.DeletedAt))
	fmt.Println("user2", user2.CreatedAt, user2.UpdatedAt, user2.DeletedAt)
	fmt.Println("user2 str", user2.CreatedAtStr, user2.UpdatedAtStr)

	var user3 UserDeleted
	cnt, err = testEngine.Where("id = ?", "lunny").Delete(&user3)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)
	assert.True(t, !isTimeZero(user3.DeletedAt))

	var user4 UserDeleted
	has, err = testEngine.Unscoped().Get(&user4)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, user3.DeletedAt.Unix(), user4.DeletedAt.Unix())
	assert.EqualValues(t, formatTime(user3.DeletedAt), formatTime(user4.DeletedAt))
	fmt.Println("user3", user3.DeletedAt, user4.DeletedAt)
}

func TestTimeUserDeletedDiffLoc(t *testing.T) {
	assert.NoError(t, prepareEngine())
	loc, err := time.LoadLocation("Asia/Shanghai")
	assert.NoError(t, err)
	testEngine.SetTZLocation(loc)
	dbLoc, err := time.LoadLocation("America/New_York")
	assert.NoError(t, err)
	testEngine.SetTZDatabase(dbLoc)

	type UserDeleted2 struct {
		Id        string
		CreatedAt time.Time `xorm:"created"`
		UpdatedAt time.Time `xorm:"updated"`
		DeletedAt time.Time `xorm:"deleted"`
	}

	assertSync(t, new(UserDeleted2))

	var user = UserDeleted2{
		Id: "lunny",
	}

	cnt, err := testEngine.Insert(&user)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)
	fmt.Println("user", user.CreatedAt, user.UpdatedAt, user.DeletedAt)

	var user2 UserDeleted2
	has, err := testEngine.Get(&user2)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, user.CreatedAt.Unix(), user2.CreatedAt.Unix())
	assert.EqualValues(t, formatTime(user.CreatedAt), formatTime(user2.CreatedAt))
	assert.EqualValues(t, user.UpdatedAt.Unix(), user2.UpdatedAt.Unix())
	assert.EqualValues(t, formatTime(user.UpdatedAt), formatTime(user2.UpdatedAt))
	assert.True(t, isTimeZero(user2.DeletedAt))
	fmt.Println("user2", user2.CreatedAt, user2.UpdatedAt, user2.DeletedAt)

	var user3 UserDeleted2
	cnt, err = testEngine.Where("id = ?", "lunny").Delete(&user3)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)
	assert.True(t, !isTimeZero(user3.DeletedAt))

	var user4 UserDeleted2
	has, err = testEngine.Unscoped().Get(&user4)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, user3.DeletedAt.Unix(), user4.DeletedAt.Unix())
	assert.EqualValues(t, formatTime(user3.DeletedAt), formatTime(user4.DeletedAt))
	fmt.Println("user3", user3.DeletedAt, user4.DeletedAt)
}

type JsonDate time.Time

func (j JsonDate) MarshalJSON() ([]byte, error) {
	if time.Time(j).IsZero() {
		return []byte(`""`), nil
	}
	return []byte(`"` + time.Time(j).Format("2006-01-02 15:04:05") + `"`), nil
}

func (j *JsonDate) UnmarshalJSON(value []byte) error {
	var v = strings.TrimSpace(strings.Trim(string(value), "\""))

	t, err := time.ParseInLocation("2006-01-02 15:04:05", v, time.Local)
	if err != nil {
		return err
	}
	*j = JsonDate(t)
	return nil
}

func (j *JsonDate) Unix() int64 {
	return (*time.Time)(j).Unix()
}

func TestCustomTimeUserDeleted(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type UserDeleted3 struct {
		Id        string
		CreatedAt JsonDate `xorm:"created"`
		UpdatedAt JsonDate `xorm:"updated"`
		DeletedAt JsonDate `xorm:"deleted"`
	}

	assertSync(t, new(UserDeleted3))

	var user = UserDeleted3{
		Id: "lunny",
	}

	cnt, err := testEngine.Insert(&user)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)
	fmt.Println("user", user.CreatedAt, user.UpdatedAt, user.DeletedAt)

	var user2 UserDeleted3
	has, err := testEngine.Get(&user2)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, user.CreatedAt.Unix(), user2.CreatedAt.Unix())
	assert.EqualValues(t, formatTime(time.Time(user.CreatedAt)), formatTime(time.Time(user2.CreatedAt)))
	assert.EqualValues(t, user.UpdatedAt.Unix(), user2.UpdatedAt.Unix())
	assert.EqualValues(t, formatTime(time.Time(user.UpdatedAt)), formatTime(time.Time(user2.UpdatedAt)))
	assert.True(t, isTimeZero(time.Time(user2.DeletedAt)))
	fmt.Println("user2", user2.CreatedAt, user2.UpdatedAt, user2.DeletedAt)

	var user3 UserDeleted3
	cnt, err = testEngine.Where("id = ?", "lunny").Delete(&user3)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)
	assert.True(t, !isTimeZero(time.Time(user3.DeletedAt)))

	var user4 UserDeleted3
	has, err = testEngine.Unscoped().Get(&user4)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, user3.DeletedAt.Unix(), user4.DeletedAt.Unix())
	assert.EqualValues(t, formatTime(time.Time(user3.DeletedAt)), formatTime(time.Time(user4.DeletedAt)))
	fmt.Println("user3", user3.DeletedAt, user4.DeletedAt)
}

func TestCustomTimeUserDeletedDiffLoc(t *testing.T) {
	assert.NoError(t, prepareEngine())
	loc, err := time.LoadLocation("Asia/Shanghai")
	assert.NoError(t, err)
	testEngine.SetTZLocation(loc)
	dbLoc, err := time.LoadLocation("America/New_York")
	assert.NoError(t, err)
	testEngine.SetTZDatabase(dbLoc)

	type UserDeleted4 struct {
		Id        string
		CreatedAt JsonDate `xorm:"created"`
		UpdatedAt JsonDate `xorm:"updated"`
		DeletedAt JsonDate `xorm:"deleted"`
	}

	assertSync(t, new(UserDeleted4))

	var user = UserDeleted4{
		Id: "lunny",
	}

	cnt, err := testEngine.Insert(&user)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)
	fmt.Println("user", user.CreatedAt, user.UpdatedAt, user.DeletedAt)

	var user2 UserDeleted4
	has, err := testEngine.Get(&user2)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, user.CreatedAt.Unix(), user2.CreatedAt.Unix())
	assert.EqualValues(t, formatTime(time.Time(user.CreatedAt)), formatTime(time.Time(user2.CreatedAt)))
	assert.EqualValues(t, user.UpdatedAt.Unix(), user2.UpdatedAt.Unix())
	assert.EqualValues(t, formatTime(time.Time(user.UpdatedAt)), formatTime(time.Time(user2.UpdatedAt)))
	assert.True(t, isTimeZero(time.Time(user2.DeletedAt)))
	fmt.Println("user2", user2.CreatedAt, user2.UpdatedAt, user2.DeletedAt)

	var user3 UserDeleted4
	cnt, err = testEngine.Where("id = ?", "lunny").Delete(&user3)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)
	assert.True(t, !isTimeZero(time.Time(user3.DeletedAt)))

	var user4 UserDeleted4
	has, err = testEngine.Unscoped().Get(&user4)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, user3.DeletedAt.Unix(), user4.DeletedAt.Unix())
	assert.EqualValues(t, formatTime(time.Time(user3.DeletedAt)), formatTime(time.Time(user4.DeletedAt)))
	fmt.Println("user3", user3.DeletedAt, user4.DeletedAt)
}

func TestDeletedInt64(t *testing.T) {
	assert.NoError(t, prepareEngine())

	type DeletedInt64Struct struct {
		Id      int64
		Deleted int64 `xorm:"deleted default(0) notnull"` // timestamp
	}

	assertSync(t, new(DeletedInt64Struct))

	var d1 DeletedInt64Struct
	cnt, err := testEngine.Insert(&d1)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	var d2 DeletedInt64Struct
	has, err := testEngine.ID(d1.Id).Get(&d2)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, d1, d2)

	cnt, err = testEngine.ID(d1.Id).NoAutoCondition().Delete(&d1)
	assert.NoError(t, err)
	assert.EqualValues(t, 1, cnt)

	var d3 DeletedInt64Struct
	has, err = testEngine.ID(d1.Id).Get(&d3)
	assert.NoError(t, err)
	assert.False(t, has)

	var d4 DeletedInt64Struct
	has, err = testEngine.ID(d1.Id).Unscoped().Get(&d4)
	assert.NoError(t, err)
	assert.True(t, has)
	assert.EqualValues(t, d1, d4)
}
