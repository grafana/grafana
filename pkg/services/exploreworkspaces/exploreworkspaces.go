package exploreworkspaces

import (
	"context"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
)

var (
	logger = log.New("exploreworkspaces")
)

type ExploreWorkspacesService struct {
	SQLStore      db.DB
	RouteRegister routing.RouteRegister
	log           log.Logger
	AccessControl accesscontrol.AccessControl
}

func ProvideService(sqlStore db.DB, routeRegister routing.RouteRegister, ds datasources.DataSourceService, ac accesscontrol.AccessControl) (*ExploreWorkspacesService, error) {
	exploreWorkspacesService := &ExploreWorkspacesService{
		SQLStore:      sqlStore,
		RouteRegister: routeRegister,
		log:           logger,
		AccessControl: ac,
	}

	exploreWorkspacesService.registerAPIEndpoints()

	return exploreWorkspacesService, nil
}

type Service interface {
	// CreateExploreWorkspace(ctx context.Context, cmd CreateExploreWorkspaceCommand) error
	GetExploreWorkspace(ctx context.Context, cmd GetExploreWorkspaceCommand) (ExploreWorkspace, error)
	// TakeExploreWorkspaceSnapshot(ctx context.Context, cmd TakeExploreWorkspaceSnapshotCommand) error
	// GetExploreWorkspaceSnapshot(ctx context.Context, cmd GetExploreWorkspaceSnapshotCommand) (ExploreWorkspaceSnapshot, error)
	// GetExploreWorkspaceSnapshots(ctx context.Context, cmd GetExploreWorkspaceSnapshotsCommand) ([]ExploreWorkspaceSnapshot, error)
}

func (s *ExploreWorkspacesService) GetExploreWorkspace(ctx context.Context, cmd GetExploreWorkspaceCommand) (ExploreWorkspace, error) {
	exploreWorkspace := &ExploreWorkspace{
		UID:               "test-iud",
		Name:              "Test name",
		Description:       "Test description",
		ActiveSnapshotUID: "Test active snapshot UID",
		OrgId:             1,
	}

	return *exploreWorkspace, nil
}
