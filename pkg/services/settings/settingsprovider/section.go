package settingsprovider

import "github.com/grafana/grafana/pkg/services/settings"

type section struct {
	settings map[string]string
}

func (s section) KeyValue(key string) settings.KeyValue {
	value, ok := s.settings[key]
	if !ok {
		return keyValue{key: key, value: ""}
	}

	return keyValue{key: key, value: value}
}

func buildSection(keyValues map[string]string) section {
	keyValuesCopy := make(map[string]string, len(keyValues))

	for key, value := range keyValues {
		keyValuesCopy[key] = value
	}

	return section{settings: keyValuesCopy}
}

type passthroughSection struct {
	section string
	impl    *Implementation
}

func (p passthroughSection) KeyValue(key string) settings.KeyValue {
	return p.impl.KeyValue(p.section, key)
}
