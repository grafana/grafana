package sqlstore

import (
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetPreferences)
	bus.AddHandler("sql", SavePreferences)
}

func GetPreferences(query *m.GetPreferencesQuery) error {

	sql := `SELECT * FROM preferences WHERE user_id = ? ` +
		`AND org_id = ?`

	var prefResults = make([]m.Preferences, 0)

	resultsErr := x.Sql(sql, query.UserId, query.OrgId).Find(&prefResults)

	if resultsErr != nil {
		return resultsErr
	}

	if len(prefResults) > 0 {
		query.Result = &prefResults[0]
	} else {
		query.Result = new(m.Preferences)
	}

	return nil
}

func SavePreferences(cmd *m.SavePreferencesCommand) error {
	return inTransaction2(func(sess *session) error {

		sql := `SELECT * FROM preferences WHERE user_id = ? ` +
			`AND org_id = ?`

		var prefResults = make([]m.Preferences, 0)

		resultsErr := sess.Sql(sql, cmd.UserId, cmd.OrgId).Find(&prefResults)

		if resultsErr != nil {
			return resultsErr
		}

		var savePref m.Preferences
		var affectedRows int64
		var saveErr error

		if len(prefResults) == 0 {
			savePref.UserId = cmd.UserId
			savePref.OrgId = cmd.OrgId
			savePref.Preference = cmd.Preference
			affectedRows, saveErr = sess.Insert(&savePref)
		} else {
			savePref = prefResults[0]
			savePref.Preference = cmd.Preference
			affectedRows, saveErr = sess.Id(savePref.Id).Update(&savePref)
		}

		if affectedRows == 0 {
			return m.ErrPreferencesNotFound
		}

		return saveErr
	})
}
