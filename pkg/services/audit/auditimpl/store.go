package auditimpl

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/audit"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type store interface {
	Insert(context.Context, *audit.AuditRecord) (int64, error)
	Search(context.Context, *audit.SearchAuditRecordsQuery) (*audit.SearchAuditRecordsQueryResult, error)
	Count(ctx context.Context) (int64, error)
}

type sqlStore struct {
	db      db.DB
	dialect migrator.Dialect
	logger  log.Logger
	cfg     *setting.Cfg
}

func ProvideStore(db db.DB, cfg *setting.Cfg) sqlStore {
	return sqlStore{
		db:      db,
		dialect: db.GetDialect(),
		cfg:     cfg,
		logger:  log.New("audit.store"),
	}
}

func (ss *sqlStore) Insert(ctx context.Context, cmd *audit.AuditRecord) (int64, error) {
	var err error
	err = ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if _, err = sess.Insert(cmd); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return 0, err
	}

	return cmd.Id, nil
}

func (ss *sqlStore) Count(ctx context.Context) (int64, error) {
	type result struct {
		Count int64
	}

	r := result{}
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		rawSQL := fmt.Sprintf("SELECT COUNT(*) as count from %s", ss.db.GetDialect().Quote("audit_record"))
		if _, err := sess.SQL(rawSQL).Get(&r); err != nil {
			return err
		}
		return nil
	})
	return r.Count, err
}

func (ss *sqlStore) Search(ctx context.Context, query *audit.SearchAuditRecordsQuery) (*audit.SearchAuditRecordsQueryResult, error) {
	result := audit.SearchAuditRecordsQueryResult{
		AuditRecords: make([]*audit.AuditRecordDTO, 0),
	}
	err := ss.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		whereConditions := make([]string, 0)
		whereParams := make([]interface{}, 0)
		sess := dbSess.Table("audit_record").Alias("ar")

		whereParams = append(whereParams, ss.dialect.BooleanStr(false))

		if len(whereConditions) > 0 {
			sess.Where(strings.Join(whereConditions, " AND "), whereParams...)
		}

		if query.Limit > 0 {
			offset := query.Limit * (query.Page - 1)
			sess.Limit(query.Limit, offset)
		}

		sess.Cols("ar.id", "ar.username", "ar.action", "ar.created_at", "ar.ip_address")
		sess.Desc("ar.created_at")
		if err := sess.Find(&result.AuditRecords); err != nil {
			return err
		}

		// get total
		user := user.User{}
		countSess := dbSess.Table("audit_record").Alias("ar")

		if len(whereConditions) > 0 {
			countSess.Where(strings.Join(whereConditions, " AND "), whereParams...)
		}

		count, err := countSess.Count(&user)
		result.TotalCount = count

		return err
	})
	return &result, err
}
