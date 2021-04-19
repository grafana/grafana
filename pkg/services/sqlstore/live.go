package sqlstore

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

func (ss *SQLStore) SaveLiveChannelData(query *models.SaveLiveChannelDataQuery) error {
	return inTransaction(func(sess *DBSession) error {
		var msg models.LiveChannel
		exists, err := sess.Where("org_id=? AND channel=?", query.OrgId, query.Channel).Get(&msg)
		if err != nil {
			return fmt.Errorf("error getting existing: %w", err)
		}
		if !exists {
			msg = models.LiveChannel{
				OrgId:   query.OrgId,
				Channel: query.Channel,
				Data:    query.Data,
				Created: time.Now(),
			}
			_, err := sess.Insert(&msg)
			if err != nil {
				return fmt.Errorf("error inserting: %w", err)
			}
			return nil
		}
		msg.Data = query.Data
		msg.Created = time.Now()
		_, err = sess.ID(msg.Id).AllCols().Update(&msg)
		if err != nil {
			return fmt.Errorf("error updating: %w", err)
		}
		return nil
	})
}

func (ss *SQLStore) GetLiveChannel(query *models.GetLiveChannelQuery) (models.LiveChannel, bool, error) {
	var msg models.LiveChannel
	exists, err := x.Where("org_id=? AND channel=?", query.OrgId, query.Channel).Get(&msg)
	if err != nil {
		return models.LiveChannel{}, false, err
	}
	return msg, exists, nil
}
