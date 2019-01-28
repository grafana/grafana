package auth

import (
	"errors"
)

// Typed errors
var (
	ErrAuthTokenNotFound = errors.New("User auth token not found")
)

type userAuthToken struct {
	Id            int64
	UserId        int64
	AuthToken     string
	PrevAuthToken string
	UserAgent     string
	ClientIp      string
	AuthTokenSeen bool
	SeenAt        int64
	RotatedAt     int64
	CreatedAt     int64
	UpdatedAt     int64
	UnhashedToken string `xorm:"-"`
}
