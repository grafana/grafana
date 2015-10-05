package sqlstore

import (
	"github.com/go-xorm/xorm"
	"github.com/Cepave/grafana/pkg/bus"
	"github.com/Cepave/grafana/pkg/log"
)

type dbTransactionFunc func(sess *xorm.Session) error
type dbTransactionFunc2 func(sess *session) error

type session struct {
	*xorm.Session
	events []interface{}
}

func (sess *session) publishAfterCommit(msg interface{}) {
	sess.events = append(sess.events, msg)
}

func inTransaction(callback dbTransactionFunc) error {
	var err error

	sess := x.NewSession()
	defer sess.Close()

	if err = sess.Begin(); err != nil {
		return err
	}

	err = callback(sess)

	if err != nil {
		sess.Rollback()
		return err
	} else if err = sess.Commit(); err != nil {
		return err
	}

	return nil
}

func inTransaction2(callback dbTransactionFunc2) error {
	var err error

	sess := session{Session: x.NewSession()}

	defer sess.Close()
	if err = sess.Begin(); err != nil {
		return err
	}

	err = callback(&sess)

	if err != nil {
		sess.Rollback()
		return err
	} else if err = sess.Commit(); err != nil {
		return err
	}

	if len(sess.events) > 0 {
		for _, e := range sess.events {
			if err = bus.Publish(e); err != nil {
				log.Error(3, "Failed to publish event after commit", err)
			}
		}
	}

	return nil
}
