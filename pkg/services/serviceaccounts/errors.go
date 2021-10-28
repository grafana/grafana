package serviceaccounts

import (
	"errors"
	"fmt"
)

var (
	ErrServiceAccountsFeatureToggleNotFound              = errors.New("service accounts feature toggle not found")
	ErrServiceAccountsAccessControlFeatureToggleNotFound = errors.New("service accounts feature need accesscontrol feature, set accesscontrol feature toggle")
)

type ErrServiceAccountNotFound struct {
	ID    int64
	OrgID int64
}

func (e ErrServiceAccountNotFound) Error() string {
	return fmt.Sprintf("Service account with id %d not found for orgID %d", e.ID, e.OrgID)
}
