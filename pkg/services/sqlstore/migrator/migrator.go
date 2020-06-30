package migrator

import (
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util/errutil"
	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
	"xorm.io/xorm"
)

type Migrator struct {
	x          *xorm.Engine
	Dialect    Dialect
	migrations []Migration
	Logger     log.Logger
}

type MigrationLog struct {
	Id          int64
	MigrationId string
	Sql         string
	Success     bool
	Error       string
	Timestamp   time.Time
}

func NewMigrator(engine *xorm.Engine) *Migrator {
	mg := &Migrator{}
	mg.x = engine
	mg.Logger = log.New("migrator")
	mg.migrations = make([]Migration, 0)
	mg.Dialect = NewDialect(mg.x)
	return mg
}

func (mg *Migrator) MigrationsCount() int {
	return len(mg.migrations)
}

func (mg *Migrator) AddMigration(id string, m Migration) {
	m.SetId(id)
	mg.migrations = append(mg.migrations, m)
}

func (mg *Migrator) GetMigrationLog() (map[string]MigrationLog, error) {
	logMap := make(map[string]MigrationLog)
	logItems := make([]MigrationLog, 0)

	exists, err := mg.x.IsTableExist(new(MigrationLog))
	if err != nil {
		return nil, err
	}

	if !exists {
		return logMap, nil
	}

	if err = mg.x.Find(&logItems); err != nil {
		return nil, err
	}

	for _, logItem := range logItems {
		if !logItem.Success {
			continue
		}
		logMap[logItem.MigrationId] = logItem
	}

	return logMap, nil
}

func (mg *Migrator) Start() error {
	mg.Logger.Info("Starting DB migration")

	logMap, err := mg.GetMigrationLog()
	if err != nil {
		return err
	}

	for _, m := range mg.migrations {
		m := m
		_, exists := logMap[m.Id()]
		if exists {
			mg.Logger.Debug("Skipping migration: Already executed", "id", m.Id())
			continue
		}

		sql := m.Sql(mg.Dialect)

		record := MigrationLog{
			MigrationId: m.Id(),
			Sql:         sql,
			Timestamp:   time.Now(),
		}

		err := mg.inTransaction(func(sess *xorm.Session) error {
			err := mg.exec(m, sess)
			if err != nil {
				mg.Logger.Error("Exec failed", "error", err, "sql", sql)
				record.Error = err.Error()
				if _, err := sess.Insert(&record); err != nil {
					return err
				}
				return err
			}
			record.Success = true
			_, err = sess.Insert(&record)
			return err
		})

		if err != nil {
			return err
		}
	}

	return nil
}

func (mg *Migrator) exec(m Migration, sess *xorm.Session) error {
	mg.Logger.Info("Executing migration", "id", m.Id())

	condition := m.GetCondition()
	if condition != nil {
		sql, args := condition.Sql(mg.Dialect)

		if sql != "" {
			mg.Logger.Debug("Executing migration condition sql", "id", m.Id(), "sql", sql, "args", args)
			results, err := sess.SQL(sql, args...).Query()
			if err != nil {
				mg.Logger.Error("Executing migration condition failed", "id", m.Id(), "error", err)
				return err
			}

			if !condition.IsFulfilled(results) {
				mg.Logger.Warn("Skipping migration: Already executed, but not recorded in migration log", "id", m.Id())
				return nil
			}
		}
	}

	var err error
	if codeMigration, ok := m.(CodeMigration); ok {
		mg.Logger.Debug("Executing code migration", "id", m.Id())
		err = codeMigration.Exec(sess, mg)
	} else {
		sql := m.Sql(mg.Dialect)
		mg.Logger.Debug("Executing sql migration", "id", m.Id(), "sql", sql)
		_, err = sess.Exec(sql)
	}

	if err != nil {
		mg.Logger.Error("Executing migration failed", "id", m.Id(), "error", err)
		return err
	}

	return nil
}

type dbTransactionFunc func(sess *xorm.Session) error

func (mg *Migrator) inTransaction(callback dbTransactionFunc) error {
	sess := mg.x.NewSession()
	defer sess.Close()

	if err := sess.Begin(); err != nil {
		return err
	}

	if err := callback(sess); err != nil {
		if rollErr := sess.Rollback(); err != rollErr {
			return errutil.Wrapf(err, "Failed to roll back transaction due to error: %s", rollErr)
		}

		return err
	}

	if err := sess.Commit(); err != nil {
		return err
	}

	return nil
}
