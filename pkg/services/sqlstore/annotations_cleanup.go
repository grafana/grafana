package sqlstore

import (
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	bus.AddHandler("sql", deleteExpiredAnnotations)
}

const MAX_HISTORY_ENTRIES_TO_DELETE = 900

func deleteExpiredAnnotations(cmd *m.DeleteExpiredVAnnotationsCommand) error {
	return inTransaction(func(sess *DBSession) error {
		daysToKeep := setting.AnnotationsDaysToKeep
		if daysToKeep < 5 {
			daysToKeep = 5
		}

		historyTimeStamp := (time.Now().Unix() - int64(daysToKeep*86400)) * 1000

		annotationsIdsToDeleteQuery := `SELECT id FROM annotation WHERE created <= ? ORDER BY id LIMIT ?`

		var annotationsIdsToDelete []interface{}
		err := sess.SQL(annotationsIdsToDeleteQuery, historyTimeStamp, MAX_HISTORY_ENTRIES_TO_DELETE).Find(&annotationsIdsToDelete)
		if err != nil {
			return err
		}

		if len(annotationsIdsToDelete) > 0 {

			deleteExpiredTagsSql := `DELETE FROM annotation_tag WHERE annotation_id IN (?` + strings.Repeat(",?", len(annotationsIdsToDelete)-1) + `)`
			sqlOrArgsTags := append([]interface{}{deleteExpiredTagsSql}, annotationsIdsToDelete...)
			_, err := sess.Exec(sqlOrArgsTags...)
			if err != nil {
				return err
			}

			deleteExpiredSql := `DELETE FROM annotation WHERE id IN (?` + strings.Repeat(",?", len(annotationsIdsToDelete)-1) + `)`
			sqlOrArgs := append([]interface{}{deleteExpiredSql}, annotationsIdsToDelete...)
			expiredResponse, err := sess.Exec(sqlOrArgs...)
			if err != nil {
				return err
			}
			cmd.DeletedRows, _ = expiredResponse.RowsAffected()
		}

		return nil
	})
}
