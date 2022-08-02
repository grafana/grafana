package util

import (
	"fmt"
	"strings"
	"time"
)

func CalculateMacroTimezoneOffset(rawTimezoneOffset string) (string, error) {
	trimmedArg := strings.Trim(rawTimezoneOffset, "\"")
	sign := trimmedArg[:1]
	timeStr := strings.Split(trimmedArg[1:], ":")

	if len(timeStr) != 2 {
		return "", fmt.Errorf("timezone argument error %v", rawTimezoneOffset)
	}

	timeParsed, err := time.ParseDuration(timeStr[0] + "h" + timeStr[1] + "m")

	if err != nil {
		return "", fmt.Errorf("timezone argument error %v", rawTimezoneOffset)
	}

	var offset string
	if sign == "-" {
		offset = "+"
	} else {
		offset = "-"
	}

	return fmt.Sprintf("%v %d", offset, int(timeParsed.Seconds())), nil
}
