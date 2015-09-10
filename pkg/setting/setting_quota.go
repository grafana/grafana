package setting

type QuotaSettings struct {
	Enabled bool
	Default map[string]int64
}

func readQuotaSettings() {
	// set global defaults.
	DefaultQuotas := make(map[string]int64)
	quota := Cfg.Section("quota")
	Quota.Enabled = quota.Key("enabled").MustBool(false)
	DefaultQuotas["user"] = quota.Key("user").MustInt64(10)
	DefaultQuotas["data_source"] = quota.Key("data_source").MustInt64(10)
	DefaultQuotas["dashboard"] = quota.Key("dashboard").MustInt64(10)
	Quota.Default = DefaultQuotas
}
