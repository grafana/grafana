package sqlstore

import (
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", deleteExpiredAnnotations)
}

const MAX_HISTORY_ENTRIES_TO_DELETE = 900

func deleteExpiredAnnotations(cmd *m.DeleteExpiredAnnotationsCommand) error {
	return inTransaction(func(sess *DBSession) error {
		historyTimeStamp := (time.Now().Unix() - int64(cmd.DaysToKeep*86400)) * 1000

		annotationIdsToDeleteQuery := `SELECT id FROM annotation WHERE created <= ? ORDER BY id LIMIT ?`

		var annotationIdsToDelete []interface{}
		err := sess.SQL(annotationIdsToDeleteQuery, historyTimeStamp, MAX_HISTORY_ENTRIES_TO_DELETE).Find(&annotationIdsToDelete)
		if err != nil {
			return err
		}

		if len(annotationIdsToDelete) > 0 {
			deleteExpiredTagsSql := `DELETE FROM annotation_tag WHERE annotation_id IN (?` + strings.Repeat(",?", len(annotationIdsToDelete)-1) + `)`
			sqlOrArgsTags := append([]interface{}{deleteExpiredTagsSql}, annotationIdsToDelete...)
			_, err := sess.Exec(sqlOrArgsTags...)
			if err != nil {
				return err
			}

			deleteExpiredSql := `DELETE FROM annotation WHERE id IN (?` + strings.Repeat(",?", len(annotationIdsToDelete)-1) + `)`
			sqlOrArgs := append([]interface{}{deleteExpiredSql}, annotationIdsToDelete...)
			expiredResponse, err := sess.Exec(sqlOrArgs...)
			if err != nil {
				return err
			}
			cmd.DeletedRows, err = expiredResponse.RowsAffected()
			if err != nil {
				return err
			}
		}

		return nil
	})
}
