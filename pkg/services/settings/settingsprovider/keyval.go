package settingsprovider

import (
	"strconv"
	"time"
)

type keyValue struct {
	key   string
	value string
}

func (kv keyValue) Key() string {
	return kv.key
}

func (kv keyValue) Value() string {
	return kv.value
}

func (kv keyValue) MustString(defaultVal string) string {
	if kv.key == "" {
		return defaultVal
	}

	return kv.value
}

func (kv keyValue) MustBool(defaultVal bool) bool {
	valueAsBool, err := strconv.ParseBool(kv.value)
	if err != nil {
		return defaultVal
	}

	return valueAsBool
}

func (kv keyValue) MustDuration(defaultVal time.Duration) time.Duration {
	valueAsDuration, err := time.ParseDuration(kv.value)
	if err != nil {
		return defaultVal
	}

	return valueAsDuration
}
