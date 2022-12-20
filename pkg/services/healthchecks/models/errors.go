package models

import "errors"

var (
	ErrCoreChecksNotRegistered = errors.New("core health checks not registered yet")
)
