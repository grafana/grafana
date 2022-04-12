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
	DefaultWeekStart string              `json:"defaultWeekStart"`
}

type DateFormatIntervals struct {
	Millisecond string `json:"millisecond"`
	Second      string `json:"second"`
	Minute      string `json:"minute"`
	Hour        string `json:"hour"`
	Day         string `json:"day"`
	Month       string `json:"month"`
	Year        string `json:"year"`
}

const localBrowser = "browser"

func valueAsTimezone(section *ini.Section, keyName string) (string, error) {
	timezone := section.Key(keyName).MustString(localBrowser)
	if timezone == localBrowser {
		return localBrowser, nil
	}

	location, err := time.LoadLocation(timezone)
	if err != nil {
		return localBrowser, err
	}

	return location.String(), nil
}

func (cfg *Cfg) readDateFormats() {
	dateFormats := cfg.Raw.Section("date_formats")
	cfg.DateFormats.FullDate = valueAsString(dateFormats, "full_date", "YYYY-MM-DD HH:mm:ss")
	cfg.DateFormats.Interval.Millisecond = valueAsString(dateFormats, "interval_millisecond", "HH:mm:ss.SSS")
	cfg.DateFormats.Interval.Second = valueAsString(dateFormats, "interval_second", "HH:mm:ss")
	cfg.DateFormats.Interval.Minute = valueAsString(dateFormats, "interval_minute", "HH:mm")
	cfg.DateFormats.Interval.Hour = valueAsString(dateFormats, "interval_hour", "MM-DD HH:mm")
	cfg.DateFormats.Interval.Day = valueAsString(dateFormats, "interval_day", "YYYY-MM-DD")
	cfg.DateFormats.Interval.Month = valueAsString(dateFormats, "interval_month", "YYYY-MM")
	cfg.DateFormats.Interval.Year = "YYYY"
	cfg.DateFormats.UseBrowserLocale = dateFormats.Key("use_browser_locale").MustBool(false)

	timezone, err := valueAsTimezone(dateFormats, "default_timezone")
	if err != nil {
		cfg.Logger.Warn("Unknown timezone as default_timezone", "err", err)
	}
	cfg.DateFormats.DefaultTimezone = timezone
	cfg.DateFormats.DefaultWeekStart = valueAsString(dateFormats, "default_week_start", "browser")
}
