package myresource

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
)

// myResourceRow maps to the my_resource SQL table.
type myResourceRow struct {
	Id        int64  `xorm:"'id' pk autoincr"`
	OrgId     int64  `xorm:"'org_id'"`
	Uid       string `xorm:"'uid'"`
	Title     string `xorm:"'title'"`
	Content   string `xorm:"'content'"`
	Ready     bool   `xorm:"'ready'"`
	CreatedBy int64  `xorm:"'created_by'"`
	CreatedAt int64  `xorm:"'created_at'"`
	UpdatedAt int64  `xorm:"'updated_at'"`
}

func (myResourceRow) TableName() string {
	return "my_resource"
}

type store struct {
	db db.DB
}

func (s *store) List(ctx context.Context, orgID int64) ([]*myResourceRow, error) {
	var rows []*myResourceRow
	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Where("org_id = ?", orgID).Find(&rows)
	})
	if err != nil {
		return nil, err
	}
	return rows, nil
}

func (s *store) Get(ctx context.Context, orgID int64, uid string) (*myResourceRow, error) {
	var row myResourceRow
	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		exists, err := sess.Where("org_id = ? AND uid = ?", orgID, uid).Get(&row)
		if err != nil {
			return err
		}
		if !exists {
			return errNotFound
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (s *store) Insert(ctx context.Context, row *myResourceRow) error {
	now := time.Now().Unix()
	row.CreatedAt = now
	row.UpdatedAt = now
	return s.db.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Insert(row)
		return err
	})
}

func (s *store) Update(ctx context.Context, row *myResourceRow) error {
	row.UpdatedAt = time.Now().Unix()
	return s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.ID(row.Id).Update(row)
		return err
	})
}

func (s *store) Delete(ctx context.Context, orgID int64, uid string) error {
	return s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Exec("DELETE FROM my_resource WHERE org_id = ? AND uid = ?", orgID, uid)
		return err
	})
}
