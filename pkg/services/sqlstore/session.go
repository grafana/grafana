package sqlstore

import (
	"context"
	"reflect"

	"github.com/go-xorm/xorm"
)

type DBSession struct {
	*xorm.Session
	events []interface{}
}

type dbTransactionFunc func(sess *DBSession) error

func (sess *DBSession) publishAfterCommit(msg interface{}) {
	sess.events = append(sess.events, msg)
}

func newSession() *DBSession {
	return &DBSession{Session: x.NewSession()}
}

func startSession(ctx context.Context) *DBSession {
	value := ctx.Value(ContextSessionName)
	var sess *DBSession
	sess, ok := value.(*DBSession)

	if !ok {
		newSess := newSession()
		newSess.Begin()
		return newSess
	}

	return sess
}

func withDbSession(ctx context.Context, callback dbTransactionFunc) error {
	sess := startSession(ctx)

	return callback(sess)
}

func (sess *DBSession) InsertId(bean interface{}) (int64, error) {
	table := sess.DB().Mapper.Obj2Table(getTypeName(bean))

	dialect.PreInsertId(table, sess.Session)

	id, err := sess.Session.InsertOne(bean)

	dialect.PostInsertId(table, sess.Session)

	return id, err
}

func getTypeName(bean interface{}) (res string) {
	t := reflect.TypeOf(bean)
	for t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	return t.Name()
}
