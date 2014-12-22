package sqlstore

import (
	"fmt"
	"os"
	"path"
	"strings"

	"github.com/torkelo/grafana-pro/pkg/log"
	m "github.com/torkelo/grafana-pro/pkg/models"
	"github.com/torkelo/grafana-pro/pkg/setting"

	"github.com/go-xorm/xorm"
	_ "github.com/mattn/go-sqlite3"
)

var (
	x      *xorm.Engine
	tables []interface{}

	HasEngine bool

	DbCfg struct {
		Type, Host, Name, User, Pwd, Path, SslMode string
	}

	UseSQLite3 bool
)

func init() {
	tables = make([]interface{}, 0)

	tables = append(tables, new(m.Account), new(m.Dashboard),
		new(m.Collaborator), new(m.DataSource))
}

func Init() {
	m.GetDashboard = GetDashboard
	m.SearchQuery = SearchQuery
	m.DeleteDashboard = DeleteDashboard
}

func NewEngine() (err error) {
	x, err = getEngine()

	if err != nil {
		return fmt.Errorf("sqlstore.init(fail to connect to database): %v", err)
	}

	err = SetEngine(x, true)

	if err != nil {
		log.Fatal(4, "fail to initialize orm engine: %v", err)
	}

	return nil
}

func SetEngine(engine *xorm.Engine, enableLog bool) (err error) {
	x = engine

	if err := x.Sync2(tables...); err != nil {
		return fmt.Errorf("sync database struct error: %v\n", err)
	}

	if enableLog {
		logPath := path.Join(setting.LogRootPath, "xorm.log")
		os.MkdirAll(path.Dir(logPath), os.ModePerm)

		f, err := os.Create(logPath)
		if err != nil {
			return fmt.Errorf("sqlstore.init(fail to create xorm.log): %v", err)
		}
		x.Logger = xorm.NewSimpleLogger(f)

		x.ShowSQL = true
		x.ShowInfo = true
		x.ShowDebug = true
		x.ShowErr = true
		x.ShowWarn = true
	}

	return nil
}

func getEngine() (*xorm.Engine, error) {
	LoadConfig()

	cnnstr := ""
	switch DbCfg.Type {
	case "mysql":
		cnnstr = fmt.Sprintf("%s:%s@tcp(%s)/%s?charset=utf8",
			DbCfg.User, DbCfg.Pwd, DbCfg.Host, DbCfg.Name)
	case "postgres":
		var host, port = "127.0.0.1", "5432"
		fields := strings.Split(DbCfg.Host, ":")
		if len(fields) > 0 && len(strings.TrimSpace(fields[0])) > 0 {
			host = fields[0]
		}
		if len(fields) > 1 && len(strings.TrimSpace(fields[1])) > 0 {
			port = fields[1]
		}
		cnnstr = fmt.Sprintf("user=%s password=%s host=%s port=%s dbname=%s sslmode=%s",
			DbCfg.User, DbCfg.Pwd, host, port, DbCfg.Name, DbCfg.SslMode)
	case "sqlite3":
		os.MkdirAll(path.Dir(DbCfg.Path), os.ModePerm)
		cnnstr = "file:" + DbCfg.Path + "?cache=shared&mode=rwc"
	default:
		return nil, fmt.Errorf("Unknown database type: %s", DbCfg.Type)
	}

	return xorm.NewEngine(DbCfg.Type, cnnstr)
}

func LoadConfig() {
	DbCfg.Type = setting.Cfg.MustValue("database", "type")
	if DbCfg.Type == "sqlite3" {
		UseSQLite3 = true
	}
	DbCfg.Host = setting.Cfg.MustValue("database", "host")
	DbCfg.Name = setting.Cfg.MustValue("database", "name")
	DbCfg.User = setting.Cfg.MustValue("database", "user")
	if len(DbCfg.Pwd) == 0 {
		DbCfg.Pwd = setting.Cfg.MustValue("database", "password")
	}
	DbCfg.SslMode = setting.Cfg.MustValue("database", "ssl_mode")
	DbCfg.Path = setting.Cfg.MustValue("database", "path", "data/grafana.db")
}

type dbTransactionFunc func(sess *xorm.Session) error

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
