package ingestinstance

import (
	"context"
	"encoding/json"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
)

var _ Store = (*SQLStore)(nil)

// ingestInstanceRow is the XORM model for the ingest_instance table.
type ingestInstanceRow struct {
	ID        int64     `xorm:"pk autoincr 'id'"`
	Token     string    `xorm:"token"`
	Name      string    `xorm:"name"`
	PluginID  string    `xorm:"plugin_id"`
	OrgID     int64     `xorm:"org_id"`
	Settings  string    `xorm:"settings"`
	CreatedAt time.Time `xorm:"created_at"`
	UpdatedAt time.Time `xorm:"updated_at"`
}

func (ingestInstanceRow) TableName() string {
	return "ingest_instance"
}

func rowToInstance(row *ingestInstanceRow) *Instance {
	return &Instance{
		ID:        row.ID,
		Token:     row.Token,
		Name:      row.Name,
		PluginID:  row.PluginID,
		OrgID:     row.OrgID,
		Settings:  json.RawMessage(row.Settings),
		CreatedAt: row.CreatedAt,
		UpdatedAt: row.UpdatedAt,
	}
}

// SQLStore is a database-backed implementation of Store.
type SQLStore struct {
	db     db.DB
	logger log.Logger
}

// NewSQLStore creates a new SQL-backed ingest instance store.
func NewSQLStore(db db.DB) *SQLStore {
	return &SQLStore{
		db:     db,
		logger: log.New("ingestinstance.sqlstore"),
	}
}

func (s *SQLStore) GetByToken(ctx context.Context, token string) (*Instance, error) {
	var row ingestInstanceRow
	var found bool

	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		found, err = sess.Table("ingest_instance").Where("token = ?", token).Get(&row)
		return err
	})
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, ErrInstanceNotFound
	}
	return rowToInstance(&row), nil
}

func (s *SQLStore) Create(ctx context.Context, instance *Instance) error {
	now := time.Now().UTC()
	row := ingestInstanceRow{
		Token:     instance.Token,
		Name:      instance.Name,
		PluginID:  instance.PluginID,
		OrgID:     instance.OrgID,
		Settings:  string(instance.Settings),
		CreatedAt: now,
		UpdatedAt: now,
	}

	return s.db.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Table("ingest_instance").Insert(&row)
		return err
	})
}

func (s *SQLStore) Update(ctx context.Context, orgID int64, token string, name string, settings json.RawMessage) (*Instance, error) {
	var result *Instance

	err := s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var row ingestInstanceRow
		found, err := sess.Table("ingest_instance").Where("token = ? AND org_id = ?", token, orgID).Get(&row)
		if err != nil {
			return err
		}
		if !found {
			return ErrInstanceNotFound
		}

		now := time.Now().UTC()
		row.Name = name
		row.Settings = string(settings)
		row.UpdatedAt = now

		_, err = sess.Table("ingest_instance").Where("id = ?", row.ID).
			Cols("name", "settings", "updated_at").Update(&row)
		if err != nil {
			return err
		}

		result = rowToInstance(&row)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (s *SQLStore) Delete(ctx context.Context, orgID int64, token string) error {
	return s.db.WithDbSession(ctx, func(sess *db.Session) error {
		affected, err := sess.Exec("DELETE FROM ingest_instance WHERE token = ? AND org_id = ?", token, orgID)
		if err != nil {
			return err
		}
		n, err := affected.RowsAffected()
		if err != nil {
			return err
		}
		if n == 0 {
			return ErrInstanceNotFound
		}
		return nil
	})
}

func (s *SQLStore) ListByOrg(ctx context.Context, orgID int64) ([]*Instance, error) {
	var rows []ingestInstanceRow

	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Table("ingest_instance").Where("org_id = ?", orgID).
			OrderBy("created_at ASC").Find(&rows)
	})
	if err != nil {
		return nil, err
	}

	result := make([]*Instance, 0, len(rows))
	for i := range rows {
		result = append(result, rowToInstance(&rows[i]))
	}
	return result, nil
}
