package sqlstore

import (
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util/errutil"
)

func init() {
	bus.AddHandler("sql", deleteExpiredAnnotations)
}

const MAX_HISTORY_ENTRIES_TO_DELETE = 900

func deleteExpiredAnnotations(cmd *m.DeleteExpiredAnnotationsCommand) error {
	return inTransaction(func(sess *DBSession) error {
		historyTimeStamp := (time.Now().Unix() - int64(cmd.DaysToKeep*86400)) * 1000

		query := "SELECT id FROM annotation WHERE created <= ? ORDER BY id LIMIT ?"
		var annotationIdsToDelete []interface{}
		if err := sess.SQL(query, historyTimeStamp, MAX_HISTORY_ENTRIES_TO_DELETE).Find(&annotationIdsToDelete); err != nil {
			return errutil.Wrapf(err, "failed to query for expired annotations")
		}
		if len(annotationIdsToDelete) == 0 {
			return nil
		}

		query = fmt.Sprintf("DELETE FROM annotation_tag WHERE annotation_id IN (?%s)", strings.Repeat(",?",
			len(annotationIdsToDelete)-1))
		sqlOrArgs := append([]interface{}{query}, annotationIdsToDelete...)
		if _, err := sess.Exec(sqlOrArgs...); err != nil {
			return errutil.Wrapf(err, "failed to delete annotation tags")
		}

		query = fmt.Sprintf("DELETE FROM annotation WHERE id IN (?%s)",
			strings.Repeat(",?", len(annotationIdsToDelete)-1))
		sqlOrArgs = append([]interface{}{query}, annotationIdsToDelete...)
		expiredResponse, err := sess.Exec(sqlOrArgs...)
		if err != nil {
			return errutil.Wrapf(err, "failed to delete annotations")
		}
		cmd.DeletedRows, err = expiredResponse.RowsAffected()
		return err
	})
}
