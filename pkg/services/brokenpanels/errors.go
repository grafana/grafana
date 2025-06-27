package brokenpanels

import (
	"errors"
)

var (
	ErrDashboardNotFound    = errors.New("dashboard not found")
	ErrPanelNotFound        = errors.New("panel not found")
	ErrInvalidQuery         = errors.New("invalid query")
	ErrAccessDenied         = errors.New("access denied")
	ErrOrganizationNotFound = errors.New("organization not found")
)
