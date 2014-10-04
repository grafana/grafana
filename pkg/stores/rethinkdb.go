package stores

import (
	"time"

	r "github.com/dancannon/gorethink"

	"github.com/torkelo/grafana-pro/pkg/log"
)

type rethinkStore struct {
	session *r.Session
}

type RethinkCfg struct {
	DatabaseName string
}

type Account struct {
	Id              int `gorethink:"id"`
	NextDashboardId int
}

func NewRethinkStore(config *RethinkCfg) *rethinkStore {
	log.Info("Initializing rethink storage")

	session, err := r.Connect(r.ConnectOpts{
		Address:     "localhost:28015",
		Database:    config.DatabaseName,
		MaxIdle:     10,
		IdleTimeout: time.Second * 10,
	})

	if err != nil {
		log.Error(3, "Failed to connect to rethink database %v", err)
	}

	createRethinkDBTablesAndIndices(config, session)

	return &rethinkStore{
		session: session,
	}
}

func (self *rethinkStore) Close() {}
