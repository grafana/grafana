package database

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type ChannelConfigStorage struct {
	store *sqlstore.SQLStore
}

func NewChannelConfigStorage(store *sqlstore.SQLStore) *ChannelConfigStorage {
	return &ChannelConfigStorage{store: store}
}

func (s *ChannelConfigStorage) CreateChannelConfig(query *models.CreateLiveChannelConfigCommand) (models.LiveChannelConfig, error) {
	// Come back to saving into database after evaluating database structure.
	//err := s.store.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
	//	params := []interface{}{query.OrgId, query.Channel, query.Data, time.Now()}
	//	upsertSQL := s.store.Dialect.UpsertSQL(
	//		"live_message",
	//		[]string{"org_id", "channel"},
	//		[]string{"org_id", "channel", "data", "published"})
	//	_, err := sess.SQL(upsertSQL, params...).Query()
	//	return err
	//})
	// return err
	//return nil
	return models.LiveChannelConfig{}, nil
}

func (s *ChannelConfigStorage) UpdateChannelConfig(query *models.UpdateLiveChannelConfigCommand) (models.LiveChannelConfig, error) {
	// Come back to saving into database after evaluating database structure.
	//var msg models.LiveMessage
	//var exists bool
	//err := s.store.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
	//	var err error
	//	exists, err = sess.Where("org_id=? AND channel=?", query.OrgId, query.Channel).Get(&msg)
	//	return err
	//})
	//return msg, exists, err
	//m, ok := s.cache.Get(getLiveMessageCacheKey(query.OrgId, query.Channel))
	//if !ok {
	//	return models.LiveMessage{}, false, nil
	//}
	//msg, ok := m.(models.LiveMessage)
	//if !ok {
	//	return models.LiveMessage{}, false, fmt.Errorf("unexpected live message type in cache: %T", m)
	//}
	//return msg, true, nil
	return models.LiveChannelConfig{}, nil
}

func (s *ChannelConfigStorage) DeleteChannelConfig(query *models.DeleteLiveChannelConfigCommand) error {
	return nil
}

func (s *ChannelConfigStorage) ListChannelConfig(query *models.ListLiveChannelConfigCommand) ([]models.LiveChannelConfig, error) {
	return nil, nil
}
