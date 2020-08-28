package setting

type DateFormats struct {
	FullDate         string              `json:"fullDate"`
	UseBrowserLocale bool                `json:"useBrowserLocale"`
	Intervals        DateFormatIntervals `json:"intervals"`
}

type DateFormatIntervals struct {
	PT1S string `json:"PT1S"`
	PT1M string `json:"PT1M"`
	PT1H string `json:"PT1H"`
	PT1D string `json:"PT1D"`
	P1YT string `json:"P1YT"`
}

func (cfg *Cfg) readDateFormats() {
	preferences := cfg.Raw.Section("preferences")
	cfg.DateFormats.FullDate, _ = valueAsString(preferences, "date_format", "YYYY-MM-DD HH:mm:ss")
	cfg.DateFormats.Intervals.PT1S, _ = valueAsString(preferences, "date_format_interval_PT1S", "HH:mm:ss")
	cfg.DateFormats.Intervals.PT1M, _ = valueAsString(preferences, "date_format_interval_PT1M", "HH:mm")
	cfg.DateFormats.Intervals.PT1H, _ = valueAsString(preferences, "date_format_interval_PT1H", "MM-DD HH:mm")
	cfg.DateFormats.Intervals.PT1D, _ = valueAsString(preferences, "date_format_interval_PT1D", "YYYY-MM-DD")
	cfg.DateFormats.Intervals.P1YT, _ = valueAsString(preferences, "date_format_interval_P1YT", "YYYY-MM")
	cfg.DateFormats.UseBrowserLocale = preferences.Key("date_format_use_browser_locale").MustBool(false)
}
