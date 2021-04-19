package settings

type Setting struct {
	Section string
	Key     string
	Value   string
}

type SettingsBag map[string]map[string]string
type SettingsRemovals map[string][]string

// ----------------------
// COMMANDS

type UpsertSettingsCommand struct {
	Settings updateRemoveSettings `json:"settings" binding:"Required"`
}

type updateRemoveSettings struct {
	Updates  SettingsBag      `json:"updates"`
	Removals SettingsRemovals `json:"removals"`
}
