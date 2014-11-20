package sqlstore

import (
	"fmt"
	"os"
	"path"
	"strings"

	"github.com/torkelo/grafana-pro/pkg/models"
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

func Init() {
	tables = append(tables, new(models.Account), new(models.Dashboard))

	models.CreateAccount = CreateAccount
	models.GetAccount = GetAccount
	models.GetAccountByLogin = GetAccountByLogin
	models.GetDashboard = GetDashboard
	models.SaveDashboard = SaveDashboard
	models.SearchQuery = SearchQuery
}

func LoadModelsConfig() {
	DbCfg.Type = setting.Cfg.MustValue("database", "type")
	if DbCfg.Type == "sqlite3" {
		UseSQLite3 = true
	}
	DbCfg.Host = setting.Cfg.MustValue("database", "host")
	DbCfg.Name = setting.Cfg.MustValue("database", "name")
	DbCfg.User = setting.Cfg.MustValue("database", "user")
	if len(DbCfg.Pwd) == 0 {
		DbCfg.Pwd = setting.Cfg.MustValue("database", "passwd")
	}
	DbCfg.SslMode = setting.Cfg.MustValue("database", "ssl_mode")
	DbCfg.Path = setting.Cfg.MustValue("database", "path", "data/grafana.db")
}

func NewEngine() (err error) {
	if err = SetEngine(); err != nil {
		return err
	}
	if err = x.Sync2(tables...); err != nil {
		return fmt.Errorf("sync database struct error: %v\n", err)
	}
	return nil
}

func SetEngine() (err error) {
	x, err = getEngine()
	if err != nil {
		return fmt.Errorf("models.init(fail to connect to database): %v", err)
	}

	logPath := path.Join(setting.LogRootPath, "xorm.log")
	os.MkdirAll(path.Dir(logPath), os.ModePerm)

	f, err := os.Create(logPath)
	if err != nil {
		return fmt.Errorf("models.init(fail to create xorm.log): %v", err)
	}
	x.Logger = xorm.NewSimpleLogger(f)

	x.ShowSQL = true
	x.ShowInfo = true
	x.ShowDebug = true
	x.ShowErr = true
	x.ShowWarn = true
	return nil
}

func getEngine() (*xorm.Engine, error) {
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
