package models

import (
	"errors"
)

// Typed errors
var (
	ErrPreferenceNotFound = errors.New("Preference not found")
)

type Preference struct {
	Id            int64
	PrefId        int64
	PrefType      string
	PrefData      map[string]interface{}
}

// ---------------------
// COMMANDS

type SavePreferenceCommand struct {
	
  PrefData map[string]interface{} `json:"prefData"`
  PrefId   int64                  `json:"-"`
	PrefType string                 `json:"-"`

}
