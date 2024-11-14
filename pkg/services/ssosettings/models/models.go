package models

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/featuremgmt/strcase"
)

type SettingsSource int

const (
	DB = iota
	System
)

func (s SettingsSource) MarshalJSON() ([]byte, error) {
	switch s {
	case DB:
		return json.Marshal("database")
	case System:
		return json.Marshal("system")
	default:
		return nil, fmt.Errorf("unknown source: %d", s)
	}
}

func (s *SettingsSource) UnmarshalJSON(data []byte) error {
	var source string
	if err := json.Unmarshal(data, &source); err != nil {
		return err
	}

	switch source {
	case "database":
		*s = DB
	case "system":
		*s = System
	default:
		return fmt.Errorf("unknown source: %s", source)
	}
	return nil
}

type SSOSettings struct {
	ID        string         `xorm:"id pk" json:"id"`
	Provider  string         `xorm:"provider" json:"provider"`
	Settings  map[string]any `xorm:"settings" json:"settings"`
	Created   time.Time      `xorm:"created" json:"-"`
	Updated   time.Time      `xorm:"updated" json:"-"`
	IsDeleted bool           `xorm:"is_deleted" json:"-"`
	Source    SettingsSource `xorm:"-" json:"source"`
}

// TableName returns the table name (needed for Xorm)
func (s SSOSettings) TableName() string {
	return "sso_setting"
}

// MarshalJSON implements the json.Marshaler interface and converts the s.Settings from map[string]any in snake_case to map[string]any in camelCase
func (s SSOSettings) MarshalJSON() ([]byte, error) {
	type Alias SSOSettings
	aux := &struct {
		*Alias
	}{
		Alias: (*Alias)(&s),
	}

	settings := make(map[string]any)
	for k, v := range aux.Settings {
		settings[strcase.ToLowerCamel(k)] = v
	}

	aux.Settings = settings
	return json.Marshal(aux)
}

// UnmarshalJSON implements the json.Unmarshaler interface and converts the settings from map[string]any camelCase to map[string]interface{} snake_case
func (s *SSOSettings) UnmarshalJSON(data []byte) error {
	type Alias SSOSettings
	aux := &struct {
		*Alias
	}{
		Alias: (*Alias)(s),
	}

	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}

	settings := make(map[string]any)
	for k, v := range aux.Settings {
		settings[strcase.ToSnake(k)] = v
	}

	s.Settings = settings
	return nil
}
