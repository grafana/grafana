package sqlstore

import (
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"

	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	bus.AddHandler("sql", GetPreferences)
	bus.AddHandler("sql", GetPreferencesWithDefaults)
	bus.AddHandler("sql", SavePreferences)
}

func GetPreferencesWithDefaults(query *m.GetPreferencesWithDefaultsQuery) error {

	prefs := make([]*m.Preferences, 0)
	filter := "(org_id=? AND user_id=?) OR (org_id=? AND user_id=0)"
	err := x.Where(filter, query.OrgId, query.UserId, query.OrgId).
		OrderBy("user_id ASC").
		Find(&prefs)

	if err != nil {
		return err
	}

	res := &m.Preferences{
		Theme:           setting.DefaultTheme,
		Timezone:        "browser",
		HomeDashboardId: 0,
	}

	for _, p := range prefs {
		if p.Theme != "" {
			res.Theme = p.Theme
		}
		if p.Timezone != "" {
			res.Timezone = p.Timezone
		}
		if p.HomeDashboardId != 0 {
			res.HomeDashboardId = p.HomeDashboardId
		}
	}

	query.Result = res
	return nil
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
	return inTransaction(func(sess *DBSession) error {

		var prefs m.Preferences
		exists, err := sess.Where("org_id=? AND user_id=?", cmd.OrgId, cmd.UserId).Get(&prefs)
		if err != nil {
			return err
		}

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
		}
		prefs.HomeDashboardId = cmd.HomeDashboardId
		prefs.Timezone = cmd.Timezone
		prefs.Theme = cmd.Theme
		prefs.Updated = time.Now()
		prefs.Version += 1
		_, err = sess.Id(prefs.Id).AllCols().Update(&prefs)
		return err
	})
}
