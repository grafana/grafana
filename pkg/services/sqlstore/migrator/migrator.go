package migrator

import (
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/log"
	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
)

type Migrator struct {
	LogLevel log.LogLevel

	x          *xorm.Engine
	dialect    Dialect
	migrations []Migration
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
	mg.LogLevel = log.WARN
	mg.migrations = make([]Migration, 0)
	mg.dialect = NewDialect(mg.x.DriverName())
	return mg
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
	if mg.LogLevel <= log.INFO {
		log.Info("Migrator: Starting DB migration")
	}

	logMap, err := mg.GetMigrationLog()
	if err != nil {
		return err
	}

	for _, m := range mg.migrations {
		_, exists := logMap[m.Id()]
		if exists {
			if mg.LogLevel <= log.DEBUG {
				log.Debug("Migrator: Skipping migration: %v, Already executed", m.Id())
			}
			continue
		}

		sql := m.Sql(mg.dialect)

		record := MigrationLog{
			MigrationId: m.Id(),
			Sql:         sql,
			Timestamp:   time.Now(),
		}

		if mg.LogLevel <= log.DEBUG {
			log.Debug("Migrator: Executing SQL: \n %v \n", sql)
		}

		if err := mg.exec(m); err != nil {
			log.Error(3, "Migrator: error: \n%s:\n%s", err, sql)
			record.Error = err.Error()
			mg.x.Insert(&record)
			return err
		} else {
			record.Success = true
			mg.x.Insert(&record)
		}
	}

	return nil
}

func (mg *Migrator) exec(m Migration) error {
	if mg.LogLevel <= log.INFO {
		log.Info("Migrator: exec migration id: %v", m.Id())
	}

	err := mg.inTransaction(func(sess *xorm.Session) error {

		condition := m.GetCondition()
		if condition != nil {
			sql, args := condition.Sql(mg.dialect)
			results, err := sess.Query(sql, args...)
			if err != nil || len(results) == 0 {
				log.Info("Migrator: skipping migration id: %v, condition not fulfilled", m.Id())
				return sess.Rollback()
			}
		}

		_, err := sess.Exec(m.Sql(mg.dialect))
		if err != nil {
			log.Error(3, "Migrator: exec FAILED migration id: %v, err: %v", m.Id(), err)
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

func (mg *Migrator) inTransaction(callback dbTransactionFunc) error {
	var err error

	sess := mg.x.NewSession()
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
