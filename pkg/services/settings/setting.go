package settings

import (
	"github.com/grafana/grafana/pkg/setting"
)

type Setting struct {
	Section string
	Key     string
	Value   string
}

// ----------------------
// COMMANDS

type UpsertSettingsCommand struct {
	Updates  setting.SettingsBag      `json:"updates"`
	Removals setting.SettingsRemovals `json:"removals"`
}
