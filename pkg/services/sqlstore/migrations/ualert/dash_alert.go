package ualert

import (
	"encoding/json"
	"time"
)

type dashAlert struct {
	Id          int64
	OrgId       int64
	DashboardId int64
	PanelId     int64
	Name        string
	Message     string
	Frequency   int64
	For         time.Duration

	Settings json.RawMessage
}

var slurpDashSQL = `
SELECT id, 
	org_id, 
	dashboard_id,
	panel_id,
	org_id,
	name,
	message,
	frequency,
	for,
	settings
FROM
	alert
`

func (m *migration) slurpDashAlerts() ([]dashAlert, error) {
	dashAlerts := []dashAlert{}
	err := m.sess.SQL(slurpDashSQL).Find(&dashAlerts)

	if err != nil {
		return nil, err
	}
	return dashAlerts, nil
}
