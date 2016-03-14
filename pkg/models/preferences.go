package models

import (
	"errors"
	"time"
)

// Typed errors
var (
	ErrPreferencesNotFound = errors.New("Preferences not found")
)

type Preferences struct {
	Id         int64
	OrgId      int64
	UserId     int64
	Version    int
	Preference map[string]interface{}
	Created    time.Time
	Updated    time.Time
}

// ---------------------
// QUERIES

type GetPreferencesQuery struct {
	Id     int64
	OrgId  int64
	UserId int64

	Result *Preferences
}

// ---------------------
// COMMANDS

type SavePreferencesCommand struct {
	Preference map[string]interface{} `json:"Preference" binding:"Required"`
	UserId     int64                  `json:"-"`
	OrgId      int64                  `json:"-"`
}

// ----------------------
// DTO & Projections

type PreferencesDTO struct {
	Id         int64                  `json:"Id"`
	UserId     int64                  `json:"UserId"`
	OrgId      int64                  `json:"OrgId"`
	Preference map[string]interface{} `json:"Preference"`
}
