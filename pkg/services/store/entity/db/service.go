package db

import (
	"xorm.io/xorm"

	// "github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/setting"
)

type EntityDBInterface interface {
	Init() error
	GetSession() (*session.SessionDB, error)
	GetEngine() (*xorm.Engine, error)
	GetCfg() *setting.Cfg
}
