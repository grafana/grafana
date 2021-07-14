package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/components/securejsondata"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type ChannelRuleStorage struct {
	store *sqlstore.SQLStore
}

func NewChannelRuleStorage(store *sqlstore.SQLStore) (*ChannelRuleStorage, error) {
	return &ChannelRuleStorage{store: store}, nil
}

func (s *ChannelRuleStorage) ListChannelRules(cmd models.ListLiveChannelRuleCommand) ([]*models.LiveChannelRule, error) {
	var result []*models.LiveChannelRule
	err := s.store.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		return sess.Where("org_id=?", cmd.OrgId).Find(&result)
	})
	return result, err
}

func (s *ChannelRuleStorage) CreateChannelRule(cmd models.CreateLiveChannelRuleCommand) (*models.LiveChannelRule, error) {
	var result *models.LiveChannelRule
	err := s.store.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		ch := &models.LiveChannelRule{
			Version: 1,
			OrgId:   cmd.OrgId,
			Pattern: cmd.Pattern,
			Config:  cmd.Config,
			Secure:  securejsondata.GetEncryptedJsonData(cmd.Secure),
			Created: time.Now(),
			Updated: time.Now(),
		}
		if _, err := sess.Insert(ch); err != nil {
			if s.store.Dialect.IsUniqueConstraintViolation(err) {
				return models.ErrLiveChannelRuleExists
			}
			return err
		}
		result = ch
		return nil
	})
	return result, err
}

func (s *ChannelRuleStorage) UpdateChannelRule(cmd models.UpdateLiveChannelRuleCommand) (*models.LiveChannelRule, error) {
	var result *models.LiveChannelRule
	err := s.store.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		ch := &models.LiveChannelRule{
			Id:      cmd.Id,
			Version: cmd.Version,
			OrgId:   cmd.OrgId,
			Pattern: cmd.Pattern,
			Config:  cmd.Config,
			Secure:  securejsondata.GetEncryptedJsonData(cmd.Secure),
			Updated: time.Now(),
		}

		updateSession := sess.Where("id=? and org_id=? and version < ?", cmd.Id, cmd.OrgId, cmd.Version)

		affected, err := updateSession.Update(ch)
		if err != nil {
			return err
		}

		if affected == 0 {
			var getCh models.LiveChannelRule
			ok, err := sess.NoAutoCondition(true).Where("id=? AND org_id=?", cmd.Id, cmd.OrgId).Get(&getCh)
			if err != nil {
				return fmt.Errorf("error getting rule: %w", err)
			}
			if !ok {
				return models.ErrLiveChannelRuleNotFound
			}
			return models.ErrLiveChannelRuleUpdatingOldVersion
		}

		result = ch
		return nil
	})
	return result, err
}

func (s *ChannelRuleStorage) DeleteChannelRule(cmd models.DeleteLiveChannelRuleCommand) (int64, error) {
	var count int64
	err := s.store.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		var err error
		var res sql.Result
		if cmd.OrgId == 0 {
			return models.ErrDataSourceIdentifierNotSet
		}
		switch {
		case cmd.Id > 0:
			res, err = sess.Exec("DELETE FROM live_channel_rule WHERE id=? and org_id=?", cmd.Id, cmd.OrgId)
		case cmd.Pattern != "":
			res, err = sess.Exec("DELETE FROM live_channel_rule WHERE pattern=? and org_id=?", cmd.Pattern, cmd.OrgId)
		default:
			return models.ErrDataSourceIdentifierNotSet
		}
		if err != nil {
			return err
		}
		count, err = res.RowsAffected()
		return err
	})
	return count, err
}

func (s *ChannelRuleStorage) GetChannelRule(cmd models.GetLiveChannelRuleCommand) (*models.LiveChannelRule, error) {
	var ch models.LiveChannelRule
	if cmd.Id > 0 {
		ch = models.LiveChannelRule{OrgId: cmd.OrgId, Id: cmd.Id}
	} else if cmd.Pattern != "" {
		ch = models.LiveChannelRule{OrgId: cmd.OrgId, Pattern: cmd.Pattern}
	} else {
		return nil, models.ErrLiveChannelRuleIdentifierNotSet
	}
	err := s.store.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		var ok bool
		var err error
		if cmd.Id > 0 {
			ok, err = sess.NoAutoCondition(true).Where("id=? AND org_id=?", cmd.Id, cmd.OrgId).Get(&ch)
		} else {
			ok, err = sess.NoAutoCondition(true).Where("pattern=? AND org_id=?", cmd.Pattern, cmd.OrgId).Get(&ch)
		}
		if err != nil {
			return err
		}
		if !ok {
			return models.ErrLiveChannelRuleNotFound
		}
		return nil
	})
	return &ch, err
}
