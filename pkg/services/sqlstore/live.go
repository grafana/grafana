package sqlstore

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

func (ss *SQLStore) SaveLiveMessage(query *models.SaveLiveMessageQuery) error {
	return inTransaction(func(sess *DBSession) error {
		var msg models.LiveMessage
		exists, err := sess.Where("org_id=? AND channel=?", query.OrgId, query.Channel).Get(&msg)
		if err != nil {
			return fmt.Errorf("error getting existing: %w", err)
		}
		if !exists {
			msg = models.LiveMessage{
				OrgId:     query.OrgId,
				Channel:   query.Channel,
				Data:      query.Data,
				Created:   time.Now(),
				CreatedBy: query.CreatedBy,
			}
			_, err := sess.Insert(&msg)
			if err != nil {
				return fmt.Errorf("error inserting: %w", err)
			}
			return nil
		}
		msg.Data = query.Data
		msg.CreatedBy = query.CreatedBy
		msg.Created = time.Now()
		_, err = sess.ID(msg.Id).AllCols().Update(&msg)
		if err != nil {
			return fmt.Errorf("error updating: %w", err)
		}
		return nil
	})
}

func (ss *SQLStore) GetLastLiveMessage(query *models.GetLastLiveMessageQuery) (models.LiveMessage, bool, error) {
	var msg models.LiveMessage
	exists, err := x.Where("org_id=? AND channel=?", query.OrgId, query.Channel).Get(&msg)
	if err != nil {
		return models.LiveMessage{}, false, err
	}
	return msg, exists, nil
}
