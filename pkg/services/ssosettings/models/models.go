package models

import (
	"encoding/json"
	"fmt"
	"time"
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

type SSOSetting struct {
	ID        string                 `xorm:"id pk" json:"-"`
	Provider  string                 `xorm:"provider" json:"provider"`
	Settings  map[string]interface{} `xorm:"settings" json:"settings"`
	Created   time.Time              `xorm:"created" json:"-"`
	Updated   time.Time              `xorm:"updated" json:"-"`
	IsDeleted bool                   `xorm:"is_deleted" json:"-"`
	Source    SettingsSource         `xorm:"-" json:"source"`
}

// TableName returns the table name (needed for Xorm)
func (s SSOSetting) TableName() string {
	return "sso_setting"
}

type SSOSettingsResponse struct {
	Settings map[string]interface{} `json:"settings"`
	Provider string                 `json:"type"`
}
