package opentsdb

import (
	"strconv"
	"time"
)

func FormatDownsampleInterval(ms int64) string {
	duration := time.Duration(ms) * time.Millisecond

	seconds := int64(duration / time.Second)
	if seconds < 60 {
		if seconds < 1 {
			return strconv.FormatInt(ms, 10) + "ms"
		}
		return strconv.FormatInt(seconds, 10) + "s"
	}

	minutes := int64(duration / time.Minute)
	if minutes < 60 {
		return strconv.FormatInt(minutes, 10) + "m"
	}

	hours := int64(duration / time.Hour)
	if hours < 24 {
		return strconv.FormatInt(hours, 10) + "h"
	}

	days := int64(duration / (24 * time.Hour))
	return strconv.FormatInt(days, 10) + "d"
}
