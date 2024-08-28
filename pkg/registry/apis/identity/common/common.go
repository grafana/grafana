package common

import (
	"strconv"
)

// OptonalFormatInt formats num as a string. If num is less or equal than 0
// an empty string is returned.
func OptionalFormatInt(num int64) string {
	if num > 0 {
		return strconv.FormatInt(num, 10)
	}
	return ""
}
