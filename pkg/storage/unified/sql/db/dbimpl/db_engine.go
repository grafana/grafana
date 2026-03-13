package dbimpl

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"

	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	_ "github.com/grafana/grafana/pkg/util/sqlite"
)

func getSession(config *DatabaseConfig) (*session.SessionDB, error) {
	switch config.Type {
	case dbTypeMySQL, dbTypePostgres, dbTypeSQLite:
		db, err := sql.Open(config.Type, config.ConnectionString)
		if err != nil {
			return nil, fmt.Errorf("open database: %w", err)
		}

		db.SetMaxOpenConns(config.MaxOpenConn)
		db.SetMaxIdleConns(config.MaxIdleConn)
		db.SetConnMaxLifetime(time.Duration(config.ConnMaxLifetime) * time.Second)

		return session.GetSession(sqlx.NewDb(db, config.Type)), nil
	default:
		return nil, fmt.Errorf("unsupported database type: %s", config.Type)
	}
}
