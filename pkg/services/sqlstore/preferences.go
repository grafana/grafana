package sqlstore

import (
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", SavePreferences)
}

func SavePreferences(cmd *m.SavePreferencesCommand) error {
	return inTransaction2(func(sess *session) error {

		sql := `SELECT * FROM preferences WHERE pref_id = ? ` +
			`AND pref_type = ?`

		var prefResults = make([]m.Preferences, 0)

		resultsErr := sess.Sql(sql, cmd.PrefId, cmd.PrefType).Find(&prefResults)

		if resultsErr != nil {
			return resultsErr
		}

		var matchedPref m.Preferences
		matchedPref = prefResults[0]
		matchedPref.PrefData = cmd.PrefData
		affectedRows, updateErr := sess.Id(matchedPref.Id).Update(&matchedPref)

		if affectedRows == 0 {
			return m.ErrPreferenceNotFound
		}

		return updateErr
	})
}
