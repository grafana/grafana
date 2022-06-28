package sqlstore

import (
	"context"
	"reflect"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/jmoiron/sqlx"
)

var sessionLogger = log.New("sqlstore.session")

type DBSession struct {
	*xorm.Session
	transactionOpen bool
	events          []interface{}
}

type DBTransactionFunc func(sess *DBSession) error

func (sess *DBSession) publishAfterCommit(msg interface{}) {
	sess.events = append(sess.events, msg)
}

// NewSession returns a new DBSession
func (ss *SQLStore) NewSession(ctx context.Context) *DBSession {
	sess := &DBSession{Session: ss.engine.NewSession()}
	sess.Session = sess.Session.Context(ctx)
	return sess
}

func (ss *SQLStore) newSession(ctx context.Context) *DBSession {
	sess := &DBSession{Session: ss.engine.NewSession()}
	sess.Session = sess.Session.Context(ctx)

	return sess
}

func startSessionOrUseExisting(ctx context.Context, engine *xorm.Engine, beginTran bool) (*DBSession, bool, error) {
	value := ctx.Value(ContextSessionKey{})
	var sess *DBSession
	sess, ok := value.(*DBSession)

	if ok {
		sessionLogger.Debug("reusing existing session", "transaction", sess.transactionOpen)
		sess.Session = sess.Session.Context(ctx)
		return sess, false, nil
	}

	newSess := &DBSession{Session: engine.NewSession(), transactionOpen: beginTran}
	if beginTran {
		err := newSess.Begin()
		if err != nil {
			return nil, false, err
		}
	}

	newSess.Session = newSess.Session.Context(ctx)
	return newSess, true, nil
}

// WithDbSession calls the callback with a session.
func (ss *SQLStore) WithDbSession(ctx context.Context, callback DBTransactionFunc) error {
	return withDbSession(ctx, ss.engine, callback)
}

func (ss *SQLStore) WithDbConn(ctx context.Context, callback DBTransactionFunc) error {
	return withDBConn(ctx, ss.sqlxDB, callback)
}

func withDBConn(ctx context.Context, db *sqlx.DB, callback DBTransactionFunc) error {
	conn, isNew, err := startConnOrUseExisting(ctx, db, false)
	if err != nil {
		return err
	}
	if isNew {
		defer conn.Close()
	}
	return callback(conn)
}

func startConnOrUseExisting(ctx context.Context, db *sqlx.DB, beginTran bool) (*sqlx.Conn, bool, error) {
	// we need to store the db connection into context, and get it out here, so if we can't find it in the context,
	// we are going to create a new db connection, otherwise we reuse the old one. it is sent when we create a new transaction

	// create a new connection and new transaction if needed
	conn, err := db.Connx(ctx)
	if err != nil {
		return nil, false, err
	}
	// newSess := &DBSession{Session: engine.NewSession(), transactionOpen: beginTran}
	if beginTran {
		tx, err := conn.BeginTxx(ctx, nil)
		if err != nil {
			return nil, false, err
		}
	}

	newSess.Session = newSess.Session.Context(ctx)
	return newSess, true, nil
}

func withDbSession(ctx context.Context, engine *xorm.Engine, callback DBTransactionFunc) error {
	sess, isNew, err := startSessionOrUseExisting(ctx, engine, false)
	if err != nil {
		return err
	}
	if isNew {
		defer sess.Close()
	}
	return callback(sess)
}

func (sess *DBSession) InsertId(bean interface{}) (int64, error) {
	table := sess.DB().Mapper.Obj2Table(getTypeName(bean))

	if err := dialect.PreInsertId(table, sess.Session); err != nil {
		return 0, err
	}
	id, err := sess.Session.InsertOne(bean)
	if err != nil {
		return 0, err
	}
	if err := dialect.PostInsertId(table, sess.Session); err != nil {
		return 0, err
	}

	return id, nil
}

func getTypeName(bean interface{}) (res string) {
	t := reflect.TypeOf(bean)
	for t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	return t.Name()
}
