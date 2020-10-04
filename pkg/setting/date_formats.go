package setting

import (
	"time"

	"gopkg.in/ini.v1"
)

type DateFormats struct {
	FullDate         string              `json:"fullDate"`
	UseBrowserLocale bool                `json:"useBrowserLocale"`
	Interval         DateFormatIntervals `json:"interval"`
	DefaultTimezone  string              `json:"defaultTimezone"`
}

type DateFormatIntervals struct {
	Second string `json:"second"`
	Minute string `json:"minute"`
	Hour   string `json:"hour"`
	Day    string `json:"day"`
	Month  string `json:"month"`
	Year   string `json:"year"`
}

const LocalBrowserTimezone = "browser"

func valueAsTimezone(section *ini.Section, keyName string, defaultValue string) (string, error) {
	timezone := section.Key(keyName).MustString(defaultValue)

	if timezone == LocalBrowserTimezone {
		return LocalBrowserTimezone, nil
	}

	location, err := time.LoadLocation(timezone)
	if err != nil {
		return LocalBrowserTimezone, err
	}

	return location.String(), nil
}

func (cfg *Cfg) readDateFormats() {
	dateFormats := cfg.Raw.Section("date_formats")
	cfg.DateFormats.FullDate = valueAsString(dateFormats, "full_date", "YYYY-MM-DD HH:mm:ss")
	cfg.DateFormats.Interval.Second = valueAsString(dateFormats, "interval_second", "HH:mm:ss")
	cfg.DateFormats.Interval.Minute = valueAsString(dateFormats, "interval_minute", "HH:mm")
	cfg.DateFormats.Interval.Hour = valueAsString(dateFormats, "interval_hour", "MM-DD HH:mm")
	cfg.DateFormats.Interval.Day = valueAsString(dateFormats, "interval_day", "YYYY-MM-DD")
	cfg.DateFormats.Interval.Month = valueAsString(dateFormats, "interval_month", "YYYY-MM")
	cfg.DateFormats.Interval.Year = "YYYY"
	cfg.DateFormats.UseBrowserLocale = dateFormats.Key("date_format_use_browser_locale").MustBool(false)

	timezone, err := valueAsTimezone(dateFormats, "default_timezone", LocalBrowserTimezone)
	if err != nil {
		cfg.Logger.Warn("Unknown timezone as default_timezone", "err", err)
	}
	cfg.DateFormats.DefaultTimezone = timezone
}
