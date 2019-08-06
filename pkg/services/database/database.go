package database

import (
	"time"

	"github.com/jinzhu/gorm"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type config struct {
	Type            string
	DSN             string
	MaxOpenConn     int
	MaxIdleConn     int
	ConnMaxLifetime int
	Logs            bool
}

type Database struct {
	Settings *setting.Cfg       `inject:""`
	SQLStore *sqlstore.SqlStore `inject:""`

	ORM *gorm.DB
	log log.Logger
}

func init() {
	registry.RegisterService(&Database{})
}

// Init initiates the database struct
func (database *Database) Init() error {
	config, err := database.readConfig()
	if err != nil {
		return err
	}

	database.log = log.New("database")

	orm, err := database.Connect(config.Type, config.DSN)
	if err != nil {
		return err
	}

	orm.LogMode(config.Logs)
	orm.SingularTable(true)

	db := orm.DB()
	db.SetMaxOpenConns(config.MaxOpenConn)
	db.SetMaxIdleConns(config.MaxIdleConn)
	db.SetConnMaxLifetime(
		time.Second * time.Duration(config.ConnMaxLifetime),
	)

	database.ORM = orm

	return nil
}

func (database *Database) readConfig() (*config, error) {
	result := &config{}
	dbconfig := database.SQLStore.DBCfg

	dsn, err := database.SQLStore.BuildConnectionString()
	if err != nil {
		return nil, err
	}

	result.DSN = dsn
	result.Type = dbconfig.Type
	result.MaxOpenConn = dbconfig.MaxOpenConn
	result.MaxIdleConn = dbconfig.MaxIdleConn
	result.ConnMaxLifetime = dbconfig.ConnMaxLifetime
	result.Logs = true //dbconfig.Logs

	return result, nil
}

// Connect connects to database
func (database *Database) Connect(dialect, dsn string) (*gorm.DB, error) {
	db, err := gorm.Open(dialect, dsn)

	if err != nil {
		return nil, err
	}

	return db, nil
}
