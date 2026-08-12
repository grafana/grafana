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
	// Deprecated:
	// only viewer role is supported
	anonSettings.OrgRole = valueAsString(anonSection, "org_role", "")
	if anonSettings.OrgRole != "Viewer" {
		cfg.Logger.Warn("auth.anonymous.org_role is deprecated, only viewer role is supported")
	}
	anonSettings.HideVersion = anonSection.Key("hide_version").MustBool(false)
	anonSettings.DeviceLimit = anonSection.Key("device_limit").MustInt64(0)
	cfg.Anonymous = anonSettings
}
