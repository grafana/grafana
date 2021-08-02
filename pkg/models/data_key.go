package models

import (
	"errors"
	"time"
)

var (
	ErrDataKeyNotFound = errors.New("data key not found")
)

type DataKey struct {
	Active        bool
	Name          string
	EntityID      string `xorm:"entity_id"`
	Provider      string
	EncryptedData []byte
	Created       time.Time
	Updated       time.Time
}
