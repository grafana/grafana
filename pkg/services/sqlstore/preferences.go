package sqlstore

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetPreferences)
	bus.AddHandler("sql", SavePreferences)
}

func GetPreferences(query *m.GetPreferencesQuery) error {

	var prefs m.Preferences
	exists, err := x.Where("org_id=? AND user_id=?", query.OrgId, query.UserId).Get(&prefs)

	if err != nil {
		return err
	}

	if exists {
		query.Result = &prefs
	} else {
		query.Result = new(m.Preferences)
	}

	return nil
}

func SavePreferences(cmd *m.SavePreferencesCommand) error {
	return inTransaction2(func(sess *session) error {

		var prefs m.Preferences
		exists, err := sess.Where("org_id=? AND user_id=?", cmd.OrgId, cmd.UserId).Get(&prefs)

		if !exists {
			prefs = m.Preferences{
				UserId:          cmd.UserId,
				OrgId:           cmd.OrgId,
				HomeDashboardId: cmd.HomeDashboardId,
				Timezone:        cmd.Timezone,
				Theme:           cmd.Theme,
				Created:         time.Now(),
				Updated:         time.Now(),
			}
			_, err = sess.Insert(&prefs)
			return err
		} else {
			prefs.HomeDashboardId = cmd.HomeDashboardId
			prefs.Timezone = cmd.Timezone
			prefs.Theme = cmd.Theme
			prefs.Updated = time.Now()
			prefs.Version += 1
			_, err = sess.Id(prefs.Id).Update(&prefs)
			return err
		}
	})
}
