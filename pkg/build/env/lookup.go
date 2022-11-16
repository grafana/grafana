package env

import (
	"strings"
)

func Lookup(name string, vars []string) (string, bool) {
	for _, v := range vars {
		if strings.HasPrefix(v, name) {
			return strings.TrimPrefix(v, name+"="), true
		}
	}

	return "", false
}
