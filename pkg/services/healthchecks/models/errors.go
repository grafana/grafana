package models

import "errors"

var (
	ErrCoreChecksNotRegistered = errors.New("core health checks not registered yet")
	ErrCoreChecksNotFinished   = errors.New("core health checks are not finished")
)
