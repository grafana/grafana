package migrations

import (
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/go-xorm/xorm"
	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
	"github.com/torkelo/grafana-pro/pkg/log"
)

type Migrator struct {
	x          *xorm.Engine
	dialect    Dialect
	migrations []Migration
}

func NewMigrator(engine *xorm.Engine) *Migrator {
	mg := &Migrator{}
	mg.x = engine
	mg.migrations = make([]Migration, 0)

	switch mg.x.DriverName() {
	case MYSQL:
		mg.dialect = new(Mysql)
	case SQLITE:
		mg.dialect = new(Sqlite3)
	}

	return mg
}

func (mg *Migrator) AddMigration(id string, m Migration) {
	m.SetId(id)
	mg.migrations = append(mg.migrations, m)
}

func (mg *Migrator) GetMigrationLog() (map[string]MigrationLog, error) {
	exists, err := mg.x.IsTableExist(new(MigrationLog))
	if err != nil {
		return nil, err
	}

	if !exists {
		if err := mg.x.CreateTables(new(MigrationLog)); err != nil {
			return nil, err
		}
		return nil, nil
	}

	logMap := make(map[string]MigrationLog)
	logItems := make([]MigrationLog, 0)
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
	log.Info("Migrator::Start DB migration")

	logMap, err := mg.GetMigrationLog()
	if err != nil {
		return err
	}

	for _, m := range mg.migrations {
		_, exists := logMap[m.Id()]
		if exists {
			log.Info("Migrator:: Skipping migration: %v, Already executed", m.Id())
			continue
		}

		record := MigrationLog{
			MigrationId: m.Id(),
			Sql:         m.Sql(mg.dialect),
			Timestamp:   time.Now(),
		}

		if err := mg.exec(m); err != nil {
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
	log.Info("Migrator::exec migration id: %v", m.Id())

	err := mg.inTransaction(func(sess *xorm.Session) error {
		_, err := sess.Exec(m.Sql(mg.dialect))
		if err != nil {
			log.Error(3, "Migrator::exec FAILED migration id: %v, err: %v", m.Id(), err)
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
