package accesscontrol

import "errors"

var (
	ErrFixedRolePrefixMissing = errors.New("fixed role should be prefixed with '" + FixedRolePrefix + "'")
	ErrInvalidBuiltinRole     = errors.New("built-in role is not valid")
	ErrInvalidScope           = errors.New("invalid scope")
	ErrResolverNotFound       = errors.New("no resolver found")
)
