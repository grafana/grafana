package database

import (
	"context"
	"os"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"

	"xorm.io/xorm"
)

var Fixtures = []models.LiveChannelRule{
	{
		OrgId:   1,
		Pattern: "stream/telegraf/*",
		Config: models.LiveChannelRulePlainConfig{
			RemoteWriteEndpoint:           os.Getenv("GF_LIVE_REMOTE_WRITE_ENDPOINT"),
			RemoteWriteSampleMilliseconds: 1000, // Write no frequently than once in a second.
		},
		Secure: models.LiveChannelRuleSecureConfig{
			RemoteWriteUser:     os.Getenv("GF_LIVE_REMOTE_WRITE_USER"),
			RemoteWritePassword: os.Getenv("GF_LIVE_REMOTE_WRITE_PASSWORD"),
		},
	},
}

type ChannelRuleStorage struct {
	store *sqlstore.SQLStore
}

func NewChannelStorage(store *sqlstore.SQLStore) (*ChannelRuleStorage, error) {
	s := &ChannelRuleStorage{store: store}
	err := s.loadFixtures()
	return s, err
}

func (s *ChannelRuleStorage) loadFixtures() error {
	for _, ch := range Fixtures {
		_, err := s.CreateChannelRule(models.CreateLiveChannelRuleCommand{
			OrgId:   ch.OrgId,
			Pattern: ch.Pattern,
			Config:  ch.Config,
			Secure:  ch.Secure,
		})
		if err != nil && err != models.ErrLiveChannelRuleExists {
			return err
		}
	}
	return nil
}

func (s *ChannelRuleStorage) ListChannelRules(query models.ListLiveChannelRulesCommand) ([]*models.LiveChannelRule, error) {
	var result []*models.LiveChannelRule
	err := s.store.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		return sess.Where("org_id=?", query.OrgId).Find(&result)
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
			//Secure:  securejsondata.GetEncryptedJsonData(cmd.Secure),
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

func (s *ChannelRuleStorage) UpdateChannelConfig(cmd models.UpdateLiveChannelRuleCommand) (*models.LiveChannelRule, error) {
	var result *models.LiveChannelRule
	err := s.store.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		ch := &models.LiveChannelRule{
			Id:      cmd.Id,
			Version: cmd.Version,
			OrgId:   cmd.OrgId,
			Pattern: cmd.Pattern,
			Config:  cmd.Config,
			//Secure:  securejsondata.GetEncryptedJsonData(cmd.Secure),
		}

		var updateSession *xorm.Session
		updateSession = sess.Where("id=? and org_id=?", cmd.Id, cmd.OrgId)

		affected, err := updateSession.Update(ch)
		if err != nil {
			return err
		}

		if affected == 0 {
			return models.ErrLiveChannelRuleUpdatingOldVersion
		}

		result = ch
		return nil
	})
	return result, err
}

func (s *ChannelRuleStorage) DeleteChannelConfig(cmd models.DeleteLiveChannelRuleCommand) error {
	err := s.store.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err := sess.Exec("DELETE FROM live_channel_rule WHERE id=? and org_id=?", cmd.Id, cmd.OrgId)
		return err
	})
	return err
}

func (s *ChannelRuleStorage) GetChannelConfig(cmd models.GetLiveChannelRuleCommand) (*models.LiveChannelRule, error) {
	ch := models.LiveChannelRule{OrgId: cmd.OrgId, Id: cmd.Id}
	err := s.store.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err := sess.Get(&ch)
		return err
	})
	return &ch, err
}
