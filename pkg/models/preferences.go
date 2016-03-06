package models

import (
	"errors"
)

// Typed errors
var (
	ErrPreferenceNotFound = errors.New("Preference not found")
)

type Preferences struct {
	Id       int64
	PrefId   int64
	PrefType string
	PrefData map[string]interface{}
}

// ---------------------
// COMMANDS

type SavePreferencesCommand struct {
	PrefData map[string]interface{} `json:"prefData" binding:"Required"`
	PrefId   int64                  `json:"-"`
	PrefType string                 `json:"-"`
}
