package env

import (
	"strings"
)

// Lookup is the equivalent of os.LookupEnv, only you are able to provide the list of environment variables.
// To use this as os.LookupEnv would be used, simply call
// `env.Lookup("ENVIRONMENT_VARIABLE", os.Environ())`
func Lookup(name string, vars []string) (string, bool) {
	for _, v := range vars {
		if strings.HasPrefix(v, name) {
			return strings.TrimPrefix(v, name+"="), true
		}
	}

	return "", false
}
