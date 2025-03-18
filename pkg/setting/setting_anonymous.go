package setting

type AnonymousSettings struct {
	Enabled     bool
	OrgName     string
	OrgRole     string
	HideVersion bool
	DeviceLimit int64
}

func (cfg *Cfg) readAnonymousSettings() {
	anonSection := cfg.Raw.Section("auth.anonymous")

	anonSettings := AnonymousSettings{}
	anonSettings.Enabled = anonSection.Key("enabled").MustBool(false)
	anonSettings.OrgName = valueAsString(anonSection, "org_name", "")
	anonSettings.OrgRole = valueAsString(anonSection, "org_role", "")
	anonSettings.HideVersion = anonSection.Key("hide_version").MustBool(false)
	anonSettings.DeviceLimit = anonSection.Key("device_limit").MustInt64(0)
	cfg.Anonymous = anonSettings
}
