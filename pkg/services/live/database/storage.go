package database

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type Storage struct {
	store *sqlstore.SQLStore
}

func NewStorage(store *sqlstore.SQLStore) *Storage {
	return &Storage{store: store}
}

func (s *Storage) SaveLiveChannelData(query *models.SaveLiveChannelDataQuery) error {
	return s.store.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		now := time.Now()
		var msg models.LiveChannel
		exists, err := sess.Where("org_id=? AND channel=?", query.OrgId, query.Channel).Get(&msg)
		if err != nil {
			return fmt.Errorf("error getting existing: %w", err)
		}
		if !exists {
			msg = models.LiveChannel{
				OrgId:     query.OrgId,
				Channel:   query.Channel,
				Data:      query.Data,
				Published: &now,
				Created:   time.Now(),
			}
			_, err := sess.Insert(&msg)
			if err != nil {
				return fmt.Errorf("error inserting: %w", err)
			}
			return nil
		}
		msg.Data = query.Data
		msg.Published = &now
		_, err = sess.ID(msg.Id).AllCols().Update(&msg)
		if err != nil {
			return fmt.Errorf("error updating: %w", err)
		}
		return nil
	})
}

func (s *Storage) GetLiveChannel(query *models.GetLiveChannelQuery) (models.LiveChannel, bool, error) {
	var msg models.LiveChannel
	var exists bool
	err := s.store.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		var err error
		exists, err = sess.Where("org_id=? AND channel=?", query.OrgId, query.Channel).Get(&msg)
		return err
	})
	return msg, exists, err
}
