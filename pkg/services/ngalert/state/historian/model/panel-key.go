package model

import (
	"github.com/grafana/grafana/pkg/infra/log"
)

// PanelKey uniquely identifies a panel.
type PanelKey struct {
	orgID   int64
	dashUID string
	panelID int64
}

func NewPanelKey(orgID int64, dashUID string, panelID int64) PanelKey {
	return PanelKey{
		orgID:   orgID,
		dashUID: dashUID,
		panelID: panelID,
	}
}

// PanelKey attempts to get the key of the panel attached to the given rule. Returns nil if the rule is not attached to a panel.
func ParsePanelKey(rule RuleMeta, logger log.Logger) *PanelKey {
	if rule.DashboardUID != "" {
		key := NewPanelKey(rule.OrgID, rule.DashboardUID, rule.PanelID)
		return &key
	}
	return nil
}

func (p PanelKey) OrgID() int64 {
	return p.orgID
}

func (p PanelKey) DashUID() string {
	return p.dashUID
}

func (p PanelKey) PanelID() int64 {
	return p.panelID
}
