package setting

import "gopkg.in/ini.v1"

type OrgQuota struct {
	User       int64 `target:"org_user"`
	DataSource int64 `target:"data_source"`
	Dashboard  int64 `target:"dashboard"`
	ApiKey     int64 `target:"api_key"`
	AlertRule  int64 `target:"alert_rule"`
}

type UserQuota struct {
	Org int64 `target:"org_user"`
}

type GlobalQuota struct {
	Org          int64 `target:"org"`
	User         int64 `target:"user"`
	DataSource   int64 `target:"data_source"`
	Dashboard    int64 `target:"dashboard"`
	ApiKey       int64 `target:"api_key"`
	Session      int64 `target:"-"`
	AlertRule    int64 `target:"alert_rule"`
	File         int64 `target:"file"`
	Correlations int64 `target:"correlations"`
}

type QuotaSettings struct {
	Enabled bool
	Org     OrgQuota
	User    UserQuota
	Global  GlobalQuota
}

func (cfg *Cfg) readQuotaSettings() {
	iniFile := cfg.Raw
	quota := ReadQuotaSettings(iniFile)
	// set global defaults.
	cfg.Quota = quota
}

func ReadQuotaSettings(iniFile *ini.File) QuotaSettings {
	section := iniFile.Section("quota")
	var quota QuotaSettings
	quota.Enabled = section.Key("enabled").MustBool(false)

	// per ORG Limits
	quota.Org = OrgQuota{
		User:       section.Key("org_user").MustInt64(10),
		DataSource: section.Key("org_data_source").MustInt64(10),
		Dashboard:  section.Key("org_dashboard").MustInt64(10),
		ApiKey:     section.Key("org_api_key").MustInt64(10),
		AlertRule:  section.Key("org_alert_rule").MustInt64(100),
	}

	// per User limits
	quota.User = UserQuota{
		Org: section.Key("user_org").MustInt64(10),
	}

	// Global Limits
	quota.Global = GlobalQuota{
		User:         section.Key("global_user").MustInt64(-1),
		Org:          section.Key("global_org").MustInt64(-1),
		DataSource:   section.Key("global_data_source").MustInt64(-1),
		Dashboard:    section.Key("global_dashboard").MustInt64(-1),
		ApiKey:       section.Key("global_api_key").MustInt64(-1),
		Session:      section.Key("global_session").MustInt64(-1),
		File:         section.Key("global_file").MustInt64(-1),
		AlertRule:    section.Key("global_alert_rule").MustInt64(-1),
		Correlations: section.Key("global_correlations").MustInt64(-1),
	}
	return quota
}
