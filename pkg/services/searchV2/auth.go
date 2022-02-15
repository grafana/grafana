package searchV2

import (
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

// ResourceFilter checks if a given a uid (resource identifier) check if we have the requested permission
type ResourceFilter func(uid string) bool

// FutureAuthService eventually implemented by the security service
type FutureAuthService interface {
	GetDashboardReadFilter(user *models.SignedInUser) (ResourceFilter, error)
}

type simpleSQLAuthService struct {
	sql *sqlstore.SQLStore
}

func (a *simpleSQLAuthService) GetDashboardReadFilter(user *models.SignedInUser) (ResourceFilter, error) {
	if user == nil || user.HasRole(models.ROLE_ADMIN) {
		return alwaysTrueFilter, nil
	}

	// TODO: find all matching IDs for the user and check results
	fmt.Printf("TODO, SELECT all ids for user: %v\n", a.sql)
	return alwaysFalseFilter, nil
}

func alwaysTrueFilter(uid string) bool {
	return true
}

func alwaysFalseFilter(uid string) bool {
	return true
}
