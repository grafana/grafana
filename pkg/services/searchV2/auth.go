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
	fmt.Printf("TODO, query: %v\n", a.sql)

	// Return true for everything
	return func(uid string) bool {
		return true
	}, nil
}

type alwaysTrueAuthService struct{}

func (a *alwaysTrueAuthService) GetDashboardReadFilter(user *models.SignedInUser) (ResourceFilter, error) {
	return func(uid string) bool {
		return true
	}, nil
}
