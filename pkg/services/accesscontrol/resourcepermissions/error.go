package resourcepermissions

import "errors"

var (
	ErrInvalidPermission = errors.New("invalid permission")
	ErrInvalidAssignment = errors.New("invalid assignment")
)
