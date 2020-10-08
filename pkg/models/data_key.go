package models

import (
	"errors"
	"time"
)

var (
	ErrDataKeyNotFound = errors.New("data key not found")
)

type DataKey struct {
	Active        bool      `json:"active"`
	Name          string    `json:"name"`
	Provider      string    `json:"provider"`
	EncryptedData []byte    `json:"-"`
	Created       time.Time `json:"created"`
	Updated       time.Time `json:"updated"`
}
