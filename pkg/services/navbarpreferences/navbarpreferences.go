package navbarpreferences

import (
	"context"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(cfg *setting.Cfg, sqlStore *sqlstore.SQLStore, routeRegister routing.RouteRegister) *NavbarPreferencesService {
	n := &NavbarPreferencesService{
		Cfg:           cfg,
		SQLStore:      sqlStore,
		RouteRegister: routeRegister,
		log:           log.New("navbarpreferences"),
	}
	n.registerAPIEndpoints()
	return n
}

// Service is a service for operating on navbar preferences.
type Service interface {
	GetNavbarPreferences(c context.Context, signedInUser *models.SignedInUser) ([]NavbarPreferenceDTO, error)
	CreateNavbarPreference(c context.Context, signedInUser *models.SignedInUser, cmd CreateNavbarPreferenceCommand) (NavbarPreferenceDTO, error)
}

// NavbarPreferencesService is the service for the navbar preferences.
type NavbarPreferencesService struct {
	Cfg           *setting.Cfg
	SQLStore      *sqlstore.SQLStore
	RouteRegister routing.RouteRegister
	log           log.Logger
}

// GetNavbarPreferences gets the navbar preferences for a user
func (n *NavbarPreferencesService) GetNavbarPreferences(c context.Context, signedInUser *models.SignedInUser) ([]NavbarPreferenceDTO, error) {
	return n.getNavbarPreferences(c, signedInUser)
}

// CreateNavbarPreference creates a navbar preference for a user and navItem
func (n *NavbarPreferencesService) CreateNavbarPreference(c context.Context, signedInUser *models.SignedInUser, cmd CreateNavbarPreferenceCommand) (NavbarPreferenceDTO, error) {
	return n.createNavbarPreference(c, signedInUser, cmd)
}
