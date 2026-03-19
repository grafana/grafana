package dbimpl

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/util/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func getEngine(config *sqlstore.DatabaseConfig) (*xorm.Engine, error) {
	engine, err := xorm.NewEngine(config.Type, config.ConnectionString)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	engine.SetMaxOpenConns(config.MaxOpenConn)
	engine.SetMaxIdleConns(config.MaxIdleConn)
	engine.SetConnMaxLifetime(time.Duration(config.ConnMaxLifetime) * time.Second)

	return engine, nil
}
