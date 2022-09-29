package serviceaccounts

import "errors"

var (
	ErrServiceAccountNotFound            = errors.New("service account not found")
	ErrServiceAccountInvalidRole         = errors.New("invalid role specified")
	ErrServiceAccountRolePrivilegeDenied = errors.New("can not assign a role higher than user's role")
)
