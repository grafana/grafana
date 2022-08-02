package util

import (
	"fmt"
	"strings"
	"time"
)

func CalculateMacroTimezoneOffset(args []string) (string, error) {
	trimmedArg := strings.Trim(args[3], "\"")
	sign := trimmedArg[:1]
	timeStr := strings.Split(trimmedArg[1:], ":")
	timeParsed, err := time.ParseDuration(timeStr[0] + "h" + timeStr[1] + "m")

	if err != nil {
		return "", fmt.Errorf("timezone argument error %v", args[3])
	}

	var offset string
	if sign == "-" {
		offset = "+"
	} else {
		offset = "-"
	}

	return fmt.Sprintf("%v %d", offset, int(timeParsed.Seconds())), nil
}
