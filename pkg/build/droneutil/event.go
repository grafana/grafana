package droneutil

import (
	"fmt"
	"os"
	"strings"
)

// Lookup is the equivalent of os.LookupEnv,  but also accepts a list of strings rather than only checking os.Environ()
func Lookup(values []string, val string) (string, bool) {
	for _, v := range values {
		prefix := val + "="
		if strings.HasPrefix(v, prefix) {
			return strings.TrimPrefix(v, prefix), true
		}
	}

	return "", false
}

// GetDroneEvent looks for the "DRONE_BUILD_EVENT" in the provided env list and returns the value.
// if it was not found, then an error is returned.
func GetDroneEvent(env []string) (string, error) {
	event, ok := Lookup(env, "DRONE_BUILD_EVENT")
	if !ok {
		return "", fmt.Errorf("failed to get DRONE_BUILD_EVENT environmental variable")
	}
	return event, nil
}

// GetDroneEventFromEnv returns the value of DRONE_BUILD_EVENT from os.Environ()
func GetDroneEventFromEnv() (string, error) {
	return GetDroneEvent(os.Environ())
}
