package sqlstore

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", SaveLiveMessage)
	bus.AddHandler("sql", GetLastLiveMessage)
}

func SaveLiveMessage(query *models.SaveLiveMessageQuery) error {
	params := query.Params
	return inTransaction(func(sess *DBSession) error {
		var msg models.LiveMessage
		exists, err := sess.Where("org_id=? AND channel=?", params.OrgId, params.Channel).Get(&msg)
		if err != nil {
			return fmt.Errorf("error getting existing: %w", err)
		}
		if !exists {
			msg = models.LiveMessage{
				OrgId:     params.OrgId,
				Channel:   params.Channel,
				Data:      params.Data,
				Created:   time.Now(),
				CreatedBy: params.CreatedBy,
			}
			_, err := sess.Insert(&msg)
			if err != nil {
				return fmt.Errorf("error inserting: %w", err)
			}
			return nil
		}
		msg.Data = params.Data
		msg.CreatedBy = params.CreatedBy
		msg.Created = time.Now()
		_, err = sess.ID(msg.Id).AllCols().Update(&msg)
		if err != nil {
			return fmt.Errorf("error updating: %w", err)
		}
		return nil
	})
}

func GetLastLiveMessage(query *models.GetLastLiveMessageQuery) error {
	var msg models.LiveMessage
	exists, err := x.Where("org_id=? AND channel=?", query.Params.OrgId, query.Params.Channel).Get(&msg)
	if err != nil {
		return err
	}
	if exists {
		query.Result = &msg
	} else {
		query.Result = nil
	}
	return nil
}
