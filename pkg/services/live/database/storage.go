package database

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/services/live/model"
)

type Storage struct {
	store db.DB
	cache *localcache.CacheService
}

func NewStorage(store db.DB, cache *localcache.CacheService) *Storage {
	return &Storage{store: store, cache: cache}
}

func getLiveMessageCacheKey(orgID int64, channel string) string {
	return fmt.Sprintf("live_message_%d_%s", orgID, channel)
}

func (s *Storage) SaveLiveMessage(query *model.SaveLiveMessageQuery) error {
	// Come back to saving into database after evaluating database structure.
	//err := s.store.WithDbSession(context.Background(), func(sess *db.Session) error {
	//	params := []interface{}{query.OrgId, query.Channel, query.Data, time.Now()}
	//	upsertSQL := s.store.Dialect.UpsertSQL(
	//		"live_message",
	//		[]string{"org_id", "channel"},
	//		[]string{"org_id", "channel", "data", "published"})
	//	_, err := sess.SQL(upsertSQL, params...).Query()
	//	return err
	//})
	// return err
	s.cache.Set(getLiveMessageCacheKey(query.OrgID, query.Channel), model.LiveMessage{
		ID:        0, // Not used actually.
		OrgID:     query.OrgID,
		Channel:   query.Channel,
		Data:      query.Data,
		Published: time.Now(),
	}, 0)
	return nil
}

func (s *Storage) GetLiveMessage(query *model.GetLiveMessageQuery) (model.LiveMessage, bool, error) {
	// Come back to saving into database after evaluating database structure.
	//var msg models.LiveMessage
	//var exists bool
	//err := s.store.WithDbSession(context.Background(), func(sess *db.Session) error {
	//	var err error
	//	exists, err = sess.Where("org_id=? AND channel=?", query.OrgId, query.Channel).Get(&msg)
	//	return err
	//})
	//return msg, exists, err
	m, ok := s.cache.Get(getLiveMessageCacheKey(query.OrgID, query.Channel))
	if !ok {
		return model.LiveMessage{}, false, nil
	}
	msg, ok := m.(model.LiveMessage)
	if !ok {
		return model.LiveMessage{}, false, fmt.Errorf("unexpected live message type in cache: %T", m)
	}
	return msg, true, nil
}
