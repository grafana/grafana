package state

import (
	"fmt"
	"math"
	"strconv"
	text_template "text/template"
	"time"
)

var funcMap = text_template.FuncMap{
	"humanize":           humanize,
	"humanize1024":       humanize1024,
	"humanizeDuration":   humanizeDuration,
	"humanizePercentage": humanizePercentage,
	"humanizeTimestamp":  humanizeTimestamp,
}

func humanize(i interface{}) (string, error) {
	v, err := convertToFloat(i)
	if err != nil {
		return "", err
	}
	if v == 0 || math.IsNaN(v) || math.IsInf(v, 0) {
		return fmt.Sprintf("%.4g", v), nil
	}
	if math.Abs(v) >= 1 {
		prefix := ""
		for _, p := range []string{"k", "M", "G", "T", "P", "E", "Z", "Y"} {
			if math.Abs(v) < 1000 {
				break
			}
			prefix = p
			v /= 1000
		}
		return fmt.Sprintf("%.4g%s", v, prefix), nil
	}
	prefix := ""
	for _, p := range []string{"m", "u", "n", "p", "f", "a", "z", "y"} {
		if math.Abs(v) >= 1 {
			break
		}
		prefix = p
		v *= 1000
	}
	return fmt.Sprintf("%.4g%s", v, prefix), nil
}

func humanize1024(i interface{}) (string, error) {
	v, err := convertToFloat(i)
	if err != nil {
		return "", err
	}
	if math.Abs(v) <= 1 || math.IsNaN(v) || math.IsInf(v, 0) {
		return fmt.Sprintf("%.4g", v), nil
	}
	prefix := ""
	for _, p := range []string{"ki", "Mi", "Gi", "Ti", "Pi", "Ei", "Zi", "Yi"} {
		if math.Abs(v) < 1024 {
			break
		}
		prefix = p
		v /= 1024
	}
	return fmt.Sprintf("%.4g%s", v, prefix), nil
}

func humanizeDuration(i interface{}) (string, error) {
	v, err := convertToFloat(i)
	if err != nil {
		return "", err
	}
	if math.IsNaN(v) || math.IsInf(v, 0) {
		return fmt.Sprintf("%.4g", v), nil
	}
	if v == 0 {
		return fmt.Sprintf("%.4gs", v), nil
	}
	if math.Abs(v) >= 1 {
		sign := ""
		if v < 0 {
			sign = "-"
			v = -v
		}
		seconds := int64(v) % 60
		minutes := (int64(v) / 60) % 60
		hours := (int64(v) / 60 / 60) % 24
		days := int64(v) / 60 / 60 / 24
		// For days to minutes, we display seconds as an integer.
		if days != 0 {
			return fmt.Sprintf("%s%dd %dh %dm %ds", sign, days, hours, minutes, seconds), nil
		}
		if hours != 0 {
			return fmt.Sprintf("%s%dh %dm %ds", sign, hours, minutes, seconds), nil
		}
		if minutes != 0 {
			return fmt.Sprintf("%s%dm %ds", sign, minutes, seconds), nil
		}
		// For seconds, we display 4 significant digits.
		return fmt.Sprintf("%s%.4gs", sign, v), nil
	}
	prefix := ""
	for _, p := range []string{"m", "u", "n", "p", "f", "a", "z", "y"} {
		if math.Abs(v) >= 1 {
			break
		}
		prefix = p
		v *= 1000
	}
	return fmt.Sprintf("%.4g%ss", v, prefix), nil
}

func humanizePercentage(i interface{}) (string, error) {
	v, err := convertToFloat(i)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%.4g%%", v*100), nil
}

func humanizeTimestamp(i interface{}) (string, error) {
	v, err := convertToFloat(i)
	if err != nil {
		return "", err
	}
	if math.IsNaN(v) || math.IsInf(v, 0) {
		return fmt.Sprintf("%.4g", v), nil
	}

	ms := (int64(v*1000) % 1000) * int64(time.Millisecond)
	t := time.Unix(int64(v), ms).UTC()
	return fmt.Sprint(t), nil
}

func convertToFloat(i interface{}) (float64, error) {
	switch v := i.(type) {
	case *float64:
		return *v, nil
	case float64:
		return v, nil
	case string:
		return strconv.ParseFloat(v, 64)
	default:
		return 0, fmt.Errorf("can't convert %T to float", v)
	}
}
