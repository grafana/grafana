package serviceaccounts

import (
	"fmt"
)

type ErrServiceAccountNotFound struct {
	ID    int64
	OrgID int64
}

func (e ErrServiceAccountNotFound) Error() string {
	return fmt.Sprintf("Service account with id %d for orgID %d not found", e.ID, e.OrgID)
}
