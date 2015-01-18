package migrations

import (
	_ "github.com/go-sql-driver/mysql"
	"github.com/go-xorm/xorm"
	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
	"github.com/torkelo/grafana-pro/pkg/log"
)

var x *xorm.Engine
var dialect Dialect

func getSchemaVersion() (int, error) {
	exists, err := x.IsTableExist(new(SchemaVersion))
	if err != nil {
		return 0, err
	}

	if !exists {
		if err := x.CreateTables(new(SchemaVersion)); err != nil {
			return 0, err
		}
		return 0, nil
	}

	v := SchemaVersion{}
	_, err = x.Table("schema_version").Limit(1, 0).Desc("version").Get(&v)
	return v.Version, err
}

func setEngineAndDialect(engine *xorm.Engine) {
	x = engine
	switch x.DriverName() {
	case MYSQL:
		dialect = new(Mysql)
	case SQLITE:
		dialect = new(Sqlite3)
	}
}

func StartMigration(engine *xorm.Engine) error {
	log.Info("Starting database schema migration: DB: %v", engine.DriverName())

	setEngineAndDialect(engine)

	_, err := getSchemaVersion()
	if err != nil {
		return err
	}

	for _, m := range migrationList {
		if err := execMigration(m); err != nil {
			return err
		}
	}

	return nil
}

func execMigration(m Migration) error {
	err := inTransaction(func(sess *xorm.Session) error {
		_, err := sess.Exec(m.Sql(dialect))
		if err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		return err
	}

	return nil
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
