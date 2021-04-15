package settings

type Setting struct {
	Section string
	Key     string
	Value   string
}

type SettingsBag map[string]map[string]string

// ----------------------
// COMMANDS

type UpsertSettingsCommand struct {
	Settings SettingsBag `json:"settings" binding:"Required"`
}
