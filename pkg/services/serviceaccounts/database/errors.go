package database

import (
	"errors"
)

var (
	ErrServiceAccountAlreadyExists    = errors.New("service account already exists")
	ErrServiceAccountTokenNotFound    = errors.New("service account token not found")
	ErrInvalidTokenExpiration         = errors.New("invalid SecondsToLive value")
	ErrDuplicateToken                 = errors.New("service account token with given name already exists in the organization")
	ErrServiceAccountAndTokenMismatch = errors.New("API token does not belong to the given service account")
)
