package setting

import (
	"os"
	"runtime"
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

const localBrowserTimezone = "browser"

// zoneInfo is the key for setting the path to look for the timezone database in go
const zoneInfo = "ZONEINFO"

func valueAsTimezone(section *ini.Section, keyName string) (string, error) {
	timezone := section.Key(keyName).MustString(localBrowserTimezone)
	if timezone == localBrowserTimezone {
		return localBrowserTimezone, nil
	}

	location, err := time.LoadLocation(timezone)
	if err != nil {
		return localBrowserTimezone, err
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

	if err := setZoneInfo(); err != nil {
		cfg.Logger.Error("Can't set ZONEINFO environment variable", "err", err)
	}
	timezone, err := valueAsTimezone(dateFormats, "default_timezone")
	if err != nil {
		cfg.Logger.Warn("Unknown timezone as default_timezone", "err", err)
	}
	cfg.DateFormats.DefaultTimezone = timezone
}

func setZoneInfo() error {
	// Fix for missing IANA db on Windows
	_, zoneInfoSet := os.LookupEnv(zoneInfo)
	if runtime.GOOS == "windows" && !zoneInfoSet {
		if err := os.Setenv(zoneInfo, HomePath+"/tools/zoneinfo.zip"); err != nil {
			return err
		}
	}
	return nil
}
