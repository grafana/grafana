package state

import (
	"fmt"
	"math"
	"strconv"
	text_template "text/template"
)

var funcMap = text_template.FuncMap{
	"humanize": humanize,
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

func convertToFloat(i interface{}) (float64, error) {
	switch v := i.(type) {
	case float64:
		return v, nil
	case string:
		return strconv.ParseFloat(v, 64)
	default:
		return 0, fmt.Errorf("can't convert %T to float", v)
	}
}
