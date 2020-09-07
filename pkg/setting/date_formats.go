package setting

type DateFormats struct {
	FullDate         string              `json:"fullDate"`
	UseBrowserLocale bool                `json:"useBrowserLocale"`
	Interval         DateFormatIntervals `json:"interval"`
}

type DateFormatIntervals struct {
	Second string `json:"second"`
	Minute string `json:"minute"`
	Hour   string `json:"hour"`
	Day    string `json:"day"`
	Month  string `json:"month"`
	Year   string `json:"year"`
}

func (cfg *Cfg) readDateFormats() {
	dateFormats := cfg.Raw.Section("date_formats")
	cfg.DateFormats.FullDate, _ = valueAsString(dateFormats, "full_date", "YYYY-MM-DD HH:mm:ss")
	cfg.DateFormats.Interval.Second, _ = valueAsString(dateFormats, "interval_second", "HH:mm:ss")
	cfg.DateFormats.Interval.Minute, _ = valueAsString(dateFormats, "interval_minute", "HH:mm")
	cfg.DateFormats.Interval.Hour, _ = valueAsString(dateFormats, "interval_hour", "MM-DD HH:mm")
	cfg.DateFormats.Interval.Day, _ = valueAsString(dateFormats, "interval_day", "YYYY-MM-DD")
	cfg.DateFormats.Interval.Month, _ = valueAsString(dateFormats, "interval_month", "YYYY-MM")
	cfg.DateFormats.Interval.Year = "YYYY"
	cfg.DateFormats.UseBrowserLocale = dateFormats.Key("date_format_use_browser_locale").MustBool(false)
}
