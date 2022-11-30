package accesscontrol

import (
	"errors"
	"fmt"
)

var (
	ErrFixedRolePrefixMissing = errors.New("fixed role should be prefixed with '" + FixedRolePrefix + "'")
	ErrInvalidBuiltinRole     = errors.New("built-in role is not valid")
	ErrInvalidScope           = errors.New("invalid scope")
	ErrResolverNotFound       = errors.New("no resolver found")
	ErrPluginIDRequired       = errors.New("plugin ID is required")
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

type ErrorScopeTarget struct {
	Action        string
	Scope         string
	ExpectedScope string
}

func (e *ErrorScopeTarget) Error() string {
	return fmt.Sprintf("expected action '%s' to be scoped with '%v', found '%v'", e.Action, e.ExpectedScope, e.Scope)
}

func (e *ErrorScopeTarget) Unwrap() error {
	return &ErrorInvalidRole{}
}
