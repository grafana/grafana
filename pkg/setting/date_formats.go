package setting

type DateFormats struct {
	FullDate         string              `json:"fullDate"`
	UseBrowserLocale bool                `json:"useBrowserLocale"`
	Intervals        DateFormatIntervals `json:"intervals"`
}

type DateFormatIntervals struct {
	Seconds string `json:"seconds"`
	Minutes string `json:"minutes"`
	Hours   string `json:"hours"`
	Days    string `json:"days"`
	Months  string `json:"months"`
	Years   string `json:"years"`
}

func (cfg *Cfg) readDateFormats() {
	preferences := cfg.Raw.Section("preferences")
	cfg.DateFormats.FullDate, _ = valueAsString(preferences, "date_format", "YYYY-MM-DD HH:mm:ss")
	cfg.DateFormats.Intervals.Seconds, _ = valueAsString(preferences, "date_format_interval_seconds", "HH:mm:ss")
	cfg.DateFormats.Intervals.Minutes, _ = valueAsString(preferences, "date_format_interval_minutes", "HH:mm")
	cfg.DateFormats.Intervals.Hours, _ = valueAsString(preferences, "date_format_interval_hours", "MM-DD HH:mm")
	cfg.DateFormats.Intervals.Days, _ = valueAsString(preferences, "date_format_interval_days", "YYYY-MM-DD")
	cfg.DateFormats.Intervals.Months, _ = valueAsString(preferences, "date_format_interval_months", "YYYY-MM")
	cfg.DateFormats.Intervals.Years = "YYYY"
	cfg.DateFormats.UseBrowserLocale = preferences.Key("date_format_use_browser_locale").MustBool(false)
}
