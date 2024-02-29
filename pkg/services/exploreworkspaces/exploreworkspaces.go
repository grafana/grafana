package exploreworkspaces

import (
	"context"
	"strconv"

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
	CreateExploreWorkspace(ctx context.Context, cmd CreateExploreWorkspaceCommand) (string, error)
	GetExploreWorkspace(ctx context.Context, cmd GetExploreWorkspaceCommand) (ExploreWorkspace, error)
	GetExploreWorkspaces(ctx context.Context, cmd GetExploreWorkspacesCommand) ([]ExploreWorkspace, error)

	// TakeExploreWorkspaceSnapshot(ctx context.Context, cmd TakeExploreWorkspaceSnapshotCommand) error
	// GetExploreWorkspaceSnapshot(ctx context.Context, cmd GetExploreWorkspaceSnapshotCommand) (ExploreWorkspaceSnapshot, error)
	// GetExploreWorkspaceSnapshots(ctx context.Context, cmd GetExploreWorkspaceSnapshotsCommand) ([]ExploreWorkspaceSnapshot, error)
}

func (s *ExploreWorkspacesService) CreateExploreWorkspace(ctx context.Context, cmd CreateExploreWorkspaceCommand) (string, error) {
	return "ID:" + cmd.Name, nil
}

func (s *ExploreWorkspacesService) GetExploreWorkspace(ctx context.Context, cmd GetExploreWorkspaceCommand) (ExploreWorkspace, error) {
	exploreWorkspace := ExploreWorkspace{
		UID:               cmd.ExploreWorkspaceUID,
		Name:              "Test name / " + cmd.ExploreWorkspaceUID + " / " + strconv.FormatInt(cmd.OrgId, 10),
		Description:       "Test description",
		ActiveSnapshotUID: "Test active snapshot UID",
		OrgId:             cmd.OrgId,
	}

	return exploreWorkspace, nil
}

func (s *ExploreWorkspacesService) GetExploreWorkspaces(ctx context.Context, cmd GetExploreWorkspacesCommand) ([]ExploreWorkspace, error) {
	exploreWorkspaces := []ExploreWorkspace{
		{
			UID:               "test-iud",
			Name:              "Test name",
			Description:       "Test description",
			ActiveSnapshotUID: "Test active snapshot UID",
			OrgId:             1,
		},
	}

	return exploreWorkspaces, nil
}
