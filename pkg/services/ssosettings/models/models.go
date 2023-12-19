package models

import (
	"encoding/json"
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
	ID            string
	Provider      string
	OAuthSettings *social.OAuthInfo
	Created       time.Time
	Updated       time.Time
	IsDeleted     bool
	Source        SettingsSource
}

type SSOSettingsDTO struct {
	ID        string         `xorm:"id pk" json:"id"`
	Provider  string         `xorm:"provider" json:"provider"`
	Settings  map[string]any `xorm:"settings" json:"settings"`
	Created   time.Time      `xorm:"created" json:"-"`
	Updated   time.Time      `xorm:"updated" json:"-"`
	IsDeleted bool           `xorm:"is_deleted" json:"-"`
	Source    SettingsSource `xorm:"-" json:"source"`
}

// TableName returns the table name (needed for Xorm)
func (s SSOSettingsDTO) TableName() string {
	return "sso_setting"
}

func (s SSOSettingsDTO) ToSSOSettings() (*SSOSettings, error) {
	settingsEncoded, err := json.Marshal(s.Settings)
	if err != nil {
		return nil, err
	}

	var settings social.OAuthInfo
	err = json.Unmarshal(settingsEncoded, &settings)
	if err != nil {
		return nil, err
	}

	return &SSOSettings{
		ID:            s.ID,
		Provider:      s.Provider,
		OAuthSettings: &settings,
		Created:       s.Created,
		Updated:       s.Updated,
		IsDeleted:     s.IsDeleted,
	}, nil
}

func (s SSOSettings) ToSSOSettingsDTO() (*SSOSettingsDTO, error) {
	settingsEncoded, err := json.Marshal(s.OAuthSettings)
	if err != nil {
		return nil, err
	}

	var settings map[string]any
	err = json.Unmarshal(settingsEncoded, &settings)
	if err != nil {
		return nil, err
	}

	if clientSecret, ok := settings["ClientSecret"].(string); ok && len(clientSecret) > 0 {
		settings["ClientSecret"] = "*********"
	}

	return &SSOSettingsDTO{
		ID:        s.ID,
		Provider:  s.Provider,
		Settings:  settings,
		Created:   s.Created,
		Updated:   s.Updated,
		IsDeleted: s.IsDeleted,
		Source:    s.Source,
	}, nil
}
