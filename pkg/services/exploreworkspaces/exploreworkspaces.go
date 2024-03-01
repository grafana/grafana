package exploreworkspaces

import (
	"context"
	"errors"
	"strconv"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

var (
	logger = log.New("exploreworkspaces")
)

type ExploreWorkspacesService struct {
	SQLStore      db.DB
	RouteRegister routing.RouteRegister
	log           log.Logger
	AccessControl accesscontrol.AccessControl
	UserService   user.Service
}

func ProvideService(sqlStore db.DB, routeRegister routing.RouteRegister, ds datasources.DataSourceService, ac accesscontrol.AccessControl, userService user.Service) (*ExploreWorkspacesService, error) {
	exploreWorkspacesService := &ExploreWorkspacesService{
		SQLStore:      sqlStore,
		RouteRegister: routeRegister,
		log:           logger,
		AccessControl: ac,
		UserService:   userService,
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
	uid := util.GenerateShortUID()

	exploreWorkspace := ExploreWorkspace{
		UID:               uid,
		Name:              cmd.Name,
		Description:       cmd.Description,
		OrgId:             cmd.OrgId,
		UserId:            cmd.UserId,
		ActiveSnapshotUID: "n/a",
	}

	storingError := s.SQLStore.WithTransactionalDbSession(ctx, func(session *db.Session) error {
		_, err := session.Insert(exploreWorkspace)
		if err != nil {
			return err
		}
		return nil
	})

	if storingError != nil {
		return "", errors.New("Storing explore workspace failed. " + storingError.Error())
	}

	return uid, nil
}

func (s *ExploreWorkspacesService) GetExploreWorkspace(ctx context.Context, cmd GetExploreWorkspaceCommand) (ExploreWorkspace, error) {
	exploreWorkspace := &ExploreWorkspace{
		UID:   cmd.ExploreWorkspaceUID,
		OrgId: cmd.OrgId,
	}

	queryError := s.SQLStore.WithTransactionalDbSession(ctx, func(session *db.Session) error {
		has, err := session.Get(exploreWorkspace)
		if err != nil {
			return err
		}
		if !has {
			return errors.New("Workspace " + cmd.ExploreWorkspaceUID + " for org:" + strconv.FormatInt(cmd.OrgId, 10) + " not found. ")
		}
		return nil
	})

	if queryError != nil {
		return *exploreWorkspace, errors.New("Getting the explore workspace " + cmd.ExploreWorkspaceUID + " for org:" + strconv.FormatInt(cmd.OrgId, 10) + " failed. " + queryError.Error())
	}

	creator, _ := s.UserService.GetByID(ctx, &user.GetUserByIDQuery{ID: exploreWorkspace.UserId})
	exploreWorkspace.User = creator

	return *exploreWorkspace, nil
}

func (s *ExploreWorkspacesService) GetExploreWorkspaces(ctx context.Context, cmd GetExploreWorkspacesCommand) ([]ExploreWorkspace, error) {
	exploreWorkspaces := make([]ExploreWorkspace, 0)

	queryError := s.SQLStore.WithTransactionalDbSession(ctx, func(session *db.Session) error {
		err := session.Find(&exploreWorkspaces, &ExploreWorkspace{OrgId: cmd.OrgId})
		if err != nil {
			return err
		}
		return nil
	})

	if queryError != nil {
		return exploreWorkspaces, errors.New("Getting explore workspaces failed. " + queryError.Error())
	}

	for idx := range exploreWorkspaces {
		exploreWorkspace := &exploreWorkspaces[idx]
		creator, _ := s.UserService.GetByID(ctx, &user.GetUserByIDQuery{ID: exploreWorkspace.UserId})
		exploreWorkspace.User = creator
	}

	return exploreWorkspaces, nil
}
