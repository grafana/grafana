package migrations

import (
	"errors"
	"fmt"

	"github.com/go-xorm/xorm"
	"github.com/torkelo/grafana-pro/pkg/services/sqlstore/sqlsyntax"
)

var x *xorm.Engine
var dialect sqlsyntax.Dialect

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

func StartMigration(engine *xorm.Engine) error {
	x = engine
	dialect = new(sqlsyntax.Sqlite3)

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

func execMigration(m *migration) error {
	err := inTransaction(func(sess *xorm.Session) error {
		_, err := sess.Exec(m.sqlite)
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return err
	}
	// verify
	if m.verifyTable != "" {
		sqlStr, args := dialect.TableCheckSql(m.verifyTable)
		results, err := x.Query(sqlStr, args...)
		if err != nil || len(results) == 0 {
			return errors.New(fmt.Sprintf("Verify failed: table %v does not exist", m.verifyTable))
		}
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
