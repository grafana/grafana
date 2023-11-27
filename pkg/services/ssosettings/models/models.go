package models

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/login/social"
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

type SSOSettings struct {
	ID            string           `json:"-"`
	Provider      string           `json:"provider"`
	OAuthSettings social.OAuthInfo `json:"oauth_settings"`
	Created       time.Time        `json:"-"`
	Updated       time.Time        `json:"-"`
	IsDeleted     bool             `json:"-"`
	Source        SettingsSource   `json:"source"`
}

type SSOSettingsDb struct {
	ID        string      `xorm:"id pk"`
	Provider  string      `xorm:"provider"`
	Settings  interface{} `xorm:"settings"`
	Created   time.Time   `xorm:"created"`
	Updated   time.Time   `xorm:"updated"`
	IsDeleted bool        `xorm:"is_deleted"`
}

// TableName returns the table name (needed for Xorm)
func (s SSOSettingsDb) TableName() string {
	return "sso_setting"
}

func (s SSOSettingsDb) ToSSOSettings() (*SSOSettings, error) {
	settings, ok := s.Settings.(social.OAuthInfo)
	if !ok {
		return nil, errors.New("invalid provider sso settings")
	}

	return &SSOSettings{
		ID:            s.ID,
		Provider:      s.Provider,
		OAuthSettings: settings,
		Created:       s.Created,
		Updated:       s.Updated,
		IsDeleted:     s.IsDeleted,
	}, nil
}

func (s SSOSettings) ToSSOSettingsDb() *SSOSettingsDb {
	return &SSOSettingsDb{
		ID:        s.ID,
		Provider:  s.Provider,
		Settings:  s.OAuthSettings,
		Created:   s.Created,
		Updated:   s.Updated,
		IsDeleted: s.IsDeleted,
	}
}

// MarshalJSON implements the json.Marshaler interface and converts the s.Settings from map[string]any to map[string]any in camelCase
//func (s SSOSetting) MarshalJSON() ([]byte, error) {
//	type Alias SSOSetting
//	aux := &struct {
//		*Alias
//	}{
//		Alias: (*Alias)(&s),
//	}
//
//	settings := make(map[string]any)
//	for k, v := range aux.Settings {
//		settings[strcase.ToLowerCamel(k)] = v
//	}
//
//	aux.Settings = settings
//	return json.Marshal(aux)
//}
//
//// UnmarshalJSON implements the json.Unmarshaler interface and converts the settings from map[string]any camelCase to map[string]interface{} snake_case
//func (s *SSOSetting) UnmarshalJSON(data []byte) error {
//	type Alias SSOSetting
//	aux := &struct {
//		*Alias
//	}{
//		Alias: (*Alias)(s),
//	}
//
//	if err := json.Unmarshal(data, &aux); err != nil {
//		return err
//	}
//
//	settings := make(map[string]any)
//	for k, v := range aux.Settings {
//		settings[strcase.ToSnake(k)] = v
//	}
//
//	s.Settings = settings
//	return nil
//}
//
//type SSOSettingsResponse struct {
//	Settings map[string]interface{} `json:"settings"`
//	Provider string                 `json:"type"`
//}
