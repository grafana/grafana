package accesscontrol

import "errors"

var (
	ErrVersionLE               = errors.New("the provided role version is smaller than or equal to stored role")
	ErrBuiltinRoleAlreadyAdded = errors.New("built-in role already has the role granted")
	ErrFixedRolePrefixMissing  = errors.New("fixed role should be prefixed with " + FixedRolePrefix)
)
