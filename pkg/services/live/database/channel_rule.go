package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/components/securejsondata"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
)

type ChannelRuleStorage struct {
	store *sqlstore.SQLStore
}

func NewChannelRuleStorage(store *sqlstore.SQLStore) (*ChannelRuleStorage, error) {
	return &ChannelRuleStorage{store: store}, nil
}

func (s *ChannelRuleStorage) ListChannelRules(ctx context.Context, cmd models.ListLiveChannelRuleCommand) ([]*models.LiveChannelRule, error) {
	var result []*models.LiveChannelRule
	err := s.store.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		return sess.Where("org_id=?", cmd.OrgId).Find(&result)
	})
	return result, err
}

func generateNewDatasourceUid(sess *sqlstore.DBSession, orgId int64) (string, error) {
	for i := 0; i < 3; i++ {
		uid := util.GenerateShortUID()
		exists, err := sess.Where("org_id=? AND uid=?", orgId, uid).Get(&models.LiveChannelRule{})
		if err != nil {
			return "", err
		}
		if !exists {
			return uid, nil
		}
	}
	return "", models.ErrLiveChannelRuleFailedGenerateUid
}

func (s *ChannelRuleStorage) CreateChannelRule(ctx context.Context, cmd models.CreateLiveChannelRuleCommand) (*models.LiveChannelRule, error) {
	var result *models.LiveChannelRule
	err := s.store.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if cmd.Uid == "" {
			uid, err := generateNewDatasourceUid(sess, cmd.OrgId)
			if err != nil {
				return fmt.Errorf("failed to generate UID for channel rule %s: %w", cmd.Pattern, err)
			}
			cmd.Uid = uid
		}

		ch := &models.LiveChannelRule{
			Uid:            cmd.Uid,
			Version:        1,
			OrgId:          cmd.OrgId,
			Pattern:        cmd.Pattern,
			Settings:       cmd.Settings,
			SecureSettings: securejsondata.GetEncryptedJsonData(cmd.SecureSettings),
			Created:        time.Now(),
			Updated:        time.Now(),
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

func (s *ChannelRuleStorage) UpdateChannelRule(ctx context.Context, cmd models.UpdateLiveChannelRuleCommand) (*models.LiveChannelRule, error) {
	var result *models.LiveChannelRule
	err := s.store.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		ch := &models.LiveChannelRule{
			Uid:            cmd.Uid,
			Version:        cmd.Version,
			OrgId:          cmd.OrgId,
			Pattern:        cmd.Pattern,
			Settings:       cmd.Settings,
			SecureSettings: securejsondata.GetEncryptedJsonData(cmd.SecureSettings),
			Updated:        time.Now(),
		}

		updateSession := sess.Where("org_id=? and uid=? and version < ?", cmd.OrgId, cmd.Uid, cmd.Version)

		affected, err := updateSession.Update(ch)
		if err != nil {
			return err
		}

		if affected == 0 {
			var getCh models.LiveChannelRule
			ok, err := sess.NoAutoCondition(true).Where("org_id=? and uid=?", cmd.OrgId, cmd.Uid).Get(&getCh)
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

func (s *ChannelRuleStorage) DeleteChannelRule(ctx context.Context, cmd models.DeleteLiveChannelRuleCommand) (int64, error) {
	var count int64
	err := s.store.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var err error
		var res sql.Result
		if cmd.OrgId == 0 {
			return models.ErrDataSourceIdentifierNotSet
		}
		switch {
		case cmd.Uid != "":
			res, err = sess.Exec("DELETE FROM live_channel_rule WHERE org_id=? and uid=?", cmd.OrgId, cmd.Uid)
		case cmd.Pattern != "":
			res, err = sess.Exec("DELETE FROM live_channel_rule WHERE org_id=? and pattern=?", cmd.OrgId, cmd.Pattern)
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

func (s *ChannelRuleStorage) GetChannelRule(ctx context.Context, cmd models.GetLiveChannelRuleCommand) (*models.LiveChannelRule, error) {
	var ch models.LiveChannelRule
	if cmd.Uid != "" {
		ch = models.LiveChannelRule{OrgId: cmd.OrgId, Uid: cmd.Uid}
	} else if cmd.Pattern != "" {
		ch = models.LiveChannelRule{OrgId: cmd.OrgId, Pattern: cmd.Pattern}
	} else {
		return nil, models.ErrLiveChannelRuleIdentifierNotSet
	}
	err := s.store.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var ok bool
		var err error
		if cmd.Uid != "" {
			ok, err = sess.NoAutoCondition(true).Where("org_id=? and uid=?", cmd.OrgId, cmd.Uid).Get(&ch)
		} else {
			ok, err = sess.NoAutoCondition(true).Where("org_id=? and pattern=?", cmd.OrgId, cmd.Pattern).Get(&ch)
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
