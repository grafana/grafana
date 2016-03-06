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

	sql := `SELECT * FROM preferences WHERE pref_id = ? ` +
		`AND pref_type = ?`

	var prefResults = make([]m.Preferences, 0)

	resultsErr := x.Sql(sql, query.PrefId, query.PrefType).Find(&prefResults)

	if resultsErr != nil {
		return resultsErr
	}
	query.Result = m.PreferencesDTO{
		PrefId:   prefResults[0].PrefId,
		PrefType: prefResults[0].PrefType,
		PrefData: prefResults[0].PrefData,
	}

	return nil
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
