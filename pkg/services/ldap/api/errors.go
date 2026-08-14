package api

import "fmt"

type OrganizationNotFoundError struct {
	OrgID int64
}

func (e *OrganizationNotFoundError) Error() string {
	return fmt.Sprintf("unable to find organization with ID '%d'", e.OrgID)
}
