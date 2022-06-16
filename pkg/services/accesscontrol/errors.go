package accesscontrol

import (
	"errors"
	"fmt"
)

var (
	ErrInvalidBuiltinRole = errors.New("built-in role is not valid")
	ErrInvalidScope       = errors.New("invalid scope")
)

type ErrorInvalidRole struct{}

func (e *ErrorInvalidRole) Error() string {
	return "role is invalid"
}

type ErrorRolePrefixMissing struct {
	Role     string
	Prefixes []string
}

func (e *ErrorRolePrefixMissing) Error() string {
	return fmt.Sprintf("expected role '%s' to be prefixed with any of '%v'", e.Role, e.Prefixes)
}

func (e *ErrorRolePrefixMissing) Unwrap() error {
	return &ErrorInvalidRole{}
}

type ErrorActionPrefixMissing struct {
	Action   string
	Prefixes []string
}

func (e *ErrorActionPrefixMissing) Error() string {
	return fmt.Sprintf("expected action '%s' to be prefixed with any of '%v'", e.Action, e.Prefixes)
}

func (e *ErrorActionPrefixMissing) Unwrap() error {
	return &ErrorInvalidRole{}
}
