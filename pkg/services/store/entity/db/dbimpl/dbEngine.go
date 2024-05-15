package dbimpl

import (
	"fmt"
	"strings"
	"time"

	iface "github.com/grafana/grafana/pkg/services/store/entity/db"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"xorm.io/xorm"
)

func getEngineMySQL(cfgSection *setting.DynamicSection) (*xorm.Engine, error) {
	dbHost := cfgSection.Key("db_host").MustString("")
	dbName := cfgSection.Key("db_name").MustString("")
	dbUser := cfgSection.Key("db_user").MustString("")
	dbPass := cfgSection.Key("db_pass").MustString("")

	// TODO: support all mysql connection options
	protocol := "tcp"
	if strings.HasPrefix(dbHost, "/") {
		protocol = "unix"
	}

	connectionString := connectionStringMySQL(dbUser, dbPass, protocol, dbHost, dbName)

	// TODO: replace xorm.NewEngine with sql.Open once we're able to get rid of
	// GetSession and GetEngine methods.
	engine, err := xorm.NewEngine(iface.DriverMySQL, connectionString)
	if err != nil {
		return nil, err
	}

	engine.SetMaxOpenConns(0)
	engine.SetMaxIdleConns(2)
	engine.SetConnMaxLifetime(time.Second * time.Duration(14400))

	return engine, nil
}

func getEnginePostgres(cfgSection *setting.DynamicSection) (*xorm.Engine, error) {
	dbHost := cfgSection.Key("db_host").MustString("")
	dbName := cfgSection.Key("db_name").MustString("")
	dbUser := cfgSection.Key("db_user").MustString("")
	dbPass := cfgSection.Key("db_pass").MustString("")

	// TODO: support all postgres connection options
	dbSslMode := cfgSection.Key("db_sslmode").MustString("disable")

	addr, err := util.SplitHostPortDefault(dbHost, "127.0.0.1", "5432")
	if err != nil {
		return nil, fmt.Errorf("invalid host specifier '%s': %w", dbHost, err)
	}

	connectionString := connectionStringPostgres(dbUser, dbPass, addr.Host, addr.Port, dbName, dbSslMode)

	// TODO: replace xorm.NewEngine with sql.Open once we're able to get rid of
	// GetSession and GetEngine methods.
	engine, err := xorm.NewEngine(iface.DriverPostgres, connectionString)
	if err != nil {
		return nil, err
	}
	return engine, nil
}

// FIXME: connection strings are not properly escaping arguments like `user` or
// `dbName`.

func connectionStringMySQL(user, password, protocol, host, dbName string) string {
	return fmt.Sprintf("%s:%s@%s(%s)/%s?collation=utf8mb4_unicode_ci&allowNativePasswords=true&clientFoundRows=true", user, password, protocol, host, dbName)
}

func connectionStringPostgres(user, password, host, port, dbName, sslMode string) string {
	return fmt.Sprintf(
		"user=%s password=%s host=%s port=%s dbname=%s sslmode=%s", // sslcert='%s' sslkey='%s' sslrootcert='%s'",
		user, password, host, port, dbName, sslMode, // ss.dbCfg.ClientCertPath, ss.dbCfg.ClientKeyPath, ss.dbCfg.CaCertPath
	)
}
