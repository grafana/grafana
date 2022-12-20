package serviceaccounts

import "errors"

var (
	ErrServiceAccountNotFound            = errors.New("service account not found")
	ErrServiceAccountInvalidRole         = errors.New("invalid role specified")
	ErrServiceAccountRolePrivilegeDenied = errors.New("can not assign a role higher than user's role")
	ErrServiceAccountInvalidOrgID        = errors.New("invalid org id specified")
	ErrServiceAccountInvalidID           = errors.New("invalid service account id specified")
	ErrServiceAccountInvalidAPIKeyID     = errors.New("invalid api key id specified")
	ErrServiceAccountInvalidTokenID      = errors.New("invalid service account token id specified")
	ErrServiceAccountUpdateForm          = errors.New("invalid update form")
)
