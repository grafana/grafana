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

// service layer
type SSOSettings struct {
	ID            string            `json:"-"`
	Provider      string            `json:"provider"`
	OAuthSettings *social.OAuthInfo `json:"oauth_settings"`
	//saml
	//ldap
	Created   time.Time      `json:"-"`
	Updated   time.Time      `json:"-"`
	IsDeleted bool           `json:"-"`
	Source    SettingsSource `json:"source"`
}

// api+db
type SSOSettingsDTO struct {
	ID        string                 `xorm:"id pk" json:"id"` // why not make this field available via api?
	Provider  string                 `xorm:"provider" json:"provider"`
	Settings  map[string]interface{} `xorm:"settings" json:"settings"`
	Created   time.Time              `xorm:"created" json:"-"`
	Updated   time.Time              `xorm:"updated" json:"-"`
	IsDeleted bool                   `xorm:"is_deleted" json:"-"`
	Source    SettingsSource         `xorm:"-" json:"source"` // why do we need this?
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

	var settings map[string]interface{}
	err = json.Unmarshal(settingsEncoded, &settings)
	if err != nil {
		return nil, err
	}

	return &SSOSettingsDTO{
		ID:        s.ID,
		Provider:  s.Provider,
		Settings:  settings,
		Created:   s.Created,
		Updated:   s.Updated,
		IsDeleted: s.IsDeleted,
	}, nil
}
