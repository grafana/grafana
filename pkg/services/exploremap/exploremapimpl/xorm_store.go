package exploremapimpl

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/exploremap"
	"github.com/grafana/grafana/pkg/util"
)

type sqlStore struct {
	db db.DB
}

const MAX_EXPLORE_MAPS = 100

var _ store = &sqlStore{}

func (s *sqlStore) Insert(ctx context.Context, cmd *exploremap.CreateExploreMapCommand) (*exploremap.ExploreMap, error) {
	m := exploremap.ExploreMap{}
	if cmd.UID == "" {
		cmd.UID = util.GenerateShortUID()
	} else {
		err := util.ValidateUID(cmd.UID)
		if err != nil {
			return nil, err
		}
	}

	err := s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		count, err := sess.SQL("SELECT COUNT(*) FROM explore_map WHERE org_id = ?", cmd.OrgID).Count()
		if err != nil {
			return err
		}
		if count > MAX_EXPLORE_MAPS {
			return fmt.Errorf("too many explore maps exist (%d > %d)", count, MAX_EXPLORE_MAPS)
		}

		now := time.Now()
		m = exploremap.ExploreMap{
			UID:       cmd.UID,
			Title:     cmd.Title,
			Data:      cmd.Data,
			OrgID:     cmd.OrgID,
			CreatedBy: cmd.CreatedBy,
			UpdatedBy: cmd.CreatedBy,
			CreatedAt: now,
			UpdatedAt: now,
		}

		_, err = sess.Insert(&m)
		return err
	})
	return &m, err
}

func (s *sqlStore) Update(ctx context.Context, cmd *exploremap.UpdateExploreMapCommand) (*exploremap.ExploreMapDTO, error) {
	dto := exploremap.ExploreMapDTO{}
	err := s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		existing := exploremap.ExploreMap{UID: cmd.UID, OrgID: cmd.OrgID}
		has, err := sess.Get(&existing)
		if err != nil {
			return err
		}
		if !has {
			return exploremap.ErrExploreMapNotFound
		}

		m := exploremap.ExploreMap{
			ID:        existing.ID,
			UID:       cmd.UID,
			Title:     cmd.Title,
			Data:      cmd.Data,
			OrgID:     cmd.OrgID,
			CreatedBy: existing.CreatedBy,
			UpdatedBy: cmd.UpdatedBy,
			CreatedAt: existing.CreatedAt,
			UpdatedAt: time.Now(),
		}

		_, err = sess.Where("id=?", m.ID).Cols("title", "data", "updated_by", "updated_at").Update(&m)
		if err != nil {
			return err
		}

		dto = exploremap.ExploreMapDTO{
			UID:       m.UID,
			Title:     m.Title,
			Data:      m.Data,
			CreatedBy: m.CreatedBy,
			UpdatedBy: m.UpdatedBy,
			CreatedAt: m.CreatedAt,
			UpdatedAt: m.UpdatedAt,
		}

		return nil
	})
	return &dto, err
}

func (s *sqlStore) Get(ctx context.Context, query *exploremap.GetExploreMapByUIDQuery) (*exploremap.ExploreMap, error) {
	if query.UID == "" || query.OrgID == 0 {
		return nil, exploremap.ErrCommandValidationFailed
	}

	m := exploremap.ExploreMap{}
	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		m = exploremap.ExploreMap{UID: query.UID, OrgID: query.OrgID}
		exists, err := sess.Get(&m)
		if !exists {
			return exploremap.ErrExploreMapNotFound
		}
		return err
	})
	return &m, err
}

func (s *sqlStore) Delete(ctx context.Context, cmd *exploremap.DeleteExploreMapCommand) error {
	if cmd.UID == "" || cmd.OrgID == 0 {
		return exploremap.ErrCommandValidationFailed
	}

	return s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		m := exploremap.ExploreMap{UID: cmd.UID, OrgID: cmd.OrgID}
		exists, err := sess.Get(&m)
		if err != nil {
			return err
		}
		if !exists {
			return exploremap.ErrExploreMapNotFound
		}

		var rawSQL = "DELETE FROM explore_map WHERE uid = ? and org_id = ?"
		_, err = sess.Exec(rawSQL, cmd.UID, cmd.OrgID)
		return err
	})
}

func (s *sqlStore) List(ctx context.Context, query *exploremap.GetExploreMapsQuery) (exploremap.ExploreMaps, error) {
	maps := make(exploremap.ExploreMaps, 0)
	if query.OrgID == 0 {
		return maps, exploremap.ErrCommandValidationFailed
	}

	if query.Limit > MAX_EXPLORE_MAPS || query.Limit < 1 {
		query.Limit = MAX_EXPLORE_MAPS
	}

	err := s.db.WithDbSession(ctx, func(dbSess *db.Session) error {
		sess := dbSess.Limit(query.Limit).Where("org_id = ?", query.OrgID).OrderBy("updated_at DESC")
		return sess.Find(&maps)
	})
	return maps, err
}
