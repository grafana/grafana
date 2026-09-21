package errortracking

import (
	"fmt"

	authlib "github.com/grafana/authlib/types"

	errortrackingserver "github.com/grafana/grafana/apps/errortracking/pkg/server"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	errortrackingstorage "github.com/grafana/grafana/pkg/storage/errortracking"
)

type AppInstaller = errortrackingserver.AppInstaller

// RegisterAppInstaller adapts Grafana's role registry to the app-owned installer.
func RegisterAppInstaller(store *errortrackingstorage.Store, accessClient authlib.AccessClient, accessControl accesscontrol.Service) (*AppInstaller, error) {
	if accessControl != nil {
		if err := accessControl.DeclareFixedRoles(FixedRoleRegistrations()...); err != nil {
			return nil, fmt.Errorf("registering error tracking access control roles: %w", err)
		}
	}
	return errortrackingserver.NewAppInstaller(store, accessClient)
}
