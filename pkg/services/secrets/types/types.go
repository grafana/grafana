package types

import (
	"errors"
	"time"
)

var ErrDataKeyNotFound = errors.New("data key not found")

type DataKey struct {
	Active        bool
	Name          string
	Scope         string
	Provider      string
	EncryptedData []byte
	Created       time.Time
	Updated       time.Time
}
