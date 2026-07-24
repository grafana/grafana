package pref

import (
	"time"
)

// IsValidTimezone checks if the timezone string is valid.
// It accepts:
// - "" - uses default
// - "utc"
// - "browser"
// - Any valid IANA timezone (e.g., "America/New_York", "Europe/London")
func IsValidTimezone(timezone string) bool {
	if timezone == "" || timezone == "utc" || timezone == "browser" {
		return true
	}

	// try to load as IANA timezone
	_, err := time.LoadLocation(timezone)
	return err == nil
}
