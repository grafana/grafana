package sqlstore

import (
	"time"
)

// timeNow makes it possible to test usage of time
var timeNow = time.Now

// func (ss *SQLStore) GetAlertById(ctx context.Context, query *models.GetAlertByIdQuery) error {
// 	return ss.WithDbSession(ctx, func(sess *DBSession) error {
// 		alert := models.Alert{}
// 		has, err := sess.ID(query.Id).Get(&alert)
// 		if !has {
// 			return fmt.Errorf("could not find alert")
// 		}
// 		if err != nil {
// 			return err
// 		}

// 		query.Result = &alert
// 		return nil
// 	})
// }
