package exploreworkspaces

import (
	"context"
	"errors"
	"strconv"
	"time"

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

	UpdateLatestExploreWorkspaceSnapshot(ctx context.Context, cmd UpdateExploreWorkspaceLatestSnapshotCommand) (*ExploreWorkspaceSnapshot, error)
	CreateExploreWorkspaceSnapshot(ctx context.Context, cmd CreateExploreWorkspaceSnapshotCommand) (*ExploreWorkspaceSnapshot, error)
	GetExploreWorkspaceSnapshot(ctx context.Context, cmd GetExploreWorkspaceSnapshotCommand) (*ExploreWorkspaceSnapshot, error)
	GetExploreWorkspaceSnapshots(ctx context.Context, cmd GetExploreWorkspaceSnapshotsCommand) ([]ExploreWorkspaceSnapshot, error)
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

		snapshot, storingSnapshotError := s.createExploreWorkspaceSnapshot(session, ctx, CreateExploreWorkspaceSnapshotCommand{
			Name:               "Latest",
			Description:        "Latest snapshot, updated with each change",
			Config:             cmd.Config,
			ExploreWorspaceUID: exploreWorkspace.UID,
			UserId:             cmd.UserId,
			Created:            time.Now(),
			Updated:            time.Now(),
			OrgId:              cmd.OrgId,
		})

		if storingSnapshotError != nil {
			return errors.New("Couldn't create snapshot for the workspace. " + err.Error())
		}
		exploreWorkspace.ActiveSnapshotUID = snapshot.UID

		_, updateSnapshotError := session.ID(exploreWorkspace.UID).AllCols().Update(exploreWorkspace)
		if updateSnapshotError != nil {
			return errors.New("Couldn't assign snapshot to the workspace. " + err.Error())
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

	snapshot, _ := s.getExploreWorkspaceSnapshot(ctx, GetExploreWorkspaceSnapshotCommand{UID: exploreWorkspace.ActiveSnapshotUID})
	exploreWorkspace.ActiveSnapshot = snapshot

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

		snapshot, _ := s.getExploreWorkspaceSnapshot(ctx, GetExploreWorkspaceSnapshotCommand{UID: exploreWorkspace.ActiveSnapshotUID})
		exploreWorkspace.ActiveSnapshot = snapshot
	}

	return exploreWorkspaces, nil
}

func (s *ExploreWorkspacesService) UpdateLatestExploreWorkspaceSnapshot(ctx context.Context, cmd UpdateExploreWorkspaceLatestSnapshotCommand) (*ExploreWorkspaceSnapshot, error) {
	exploreWorkspace, queryWorkspaceError := s.GetExploreWorkspace(ctx, GetExploreWorkspaceCommand{
		ExploreWorkspaceUID: cmd.ExploreWorspaceUID,
	})

	if queryWorkspaceError != nil {
		return nil, errors.New("Cannot retrieve workspace " + cmd.ExploreWorspaceUID + ". " + queryWorkspaceError.Error())
	}

	exploreWorkspaceSnapshot, querySnapshotError := s.updateExploreWorkspaceSnapshot(ctx, UpdateExploreWorkspaceSnapshotCommand{
		UID:         exploreWorkspace.ActiveSnapshotUID,
		Name:        exploreWorkspace.ActiveSnapshot.Name,
		Description: exploreWorkspace.ActiveSnapshot.Description,
		Updated:     cmd.Updated,
		UserId:      cmd.UserId,
		Config:      cmd.Config,
	})

	if querySnapshotError != nil {
		return nil, querySnapshotError
	}

	return exploreWorkspaceSnapshot, nil
}

func (s *ExploreWorkspacesService) CreateExploreWorkspaceSnapshot(ctx context.Context, cmd CreateExploreWorkspaceSnapshotCommand) (*ExploreWorkspaceSnapshot, error) {
	exploreWorkspace, queryWorkspaceError := s.GetExploreWorkspace(ctx, GetExploreWorkspaceCommand{
		ExploreWorkspaceUID: cmd.ExploreWorspaceUID,
		OrgId:               cmd.OrgId,
	})

	if queryWorkspaceError != nil {
		return nil, queryWorkspaceError
	}

	latest := exploreWorkspace.ActiveSnapshot

	createExploreWorkspaceSnapshotCommand := CreateExploreWorkspaceSnapshotCommand{
		ExploreWorspaceUID: latest.ExploreWorspaceUID,
		Name:               cmd.Name,
		Description:        cmd.Description,
		Created:            time.Now(),
		Updated:            time.Now(),
		UserId:             cmd.UserId,
		Config:             latest.Config,
	}

	var exploreWorkspaceSnapshot ExploreWorkspaceSnapshot
	snapshotError := s.SQLStore.WithTransactionalDbSession(ctx, func(session *db.Session) error {
		snapshot, err := s.createExploreWorkspaceSnapshot(session, ctx, createExploreWorkspaceSnapshotCommand)
		exploreWorkspaceSnapshot = snapshot
		return err
	})

	return &exploreWorkspaceSnapshot, snapshotError

}

func (s *ExploreWorkspacesService) GetExploreWorkspaceSnapshot(ctx context.Context, cmd GetExploreWorkspaceSnapshotCommand) (*ExploreWorkspaceSnapshot, error) {
	exploreWorkspaceSnapshot := ExploreWorkspaceSnapshot{
		UID: cmd.UID,
	}

	snapshotError := s.SQLStore.WithTransactionalDbSession(ctx, func(session *db.Session) error {
		has, err := session.Get(&exploreWorkspaceSnapshot)

		if err != nil {
			return err
		}
		if !has {
			return errors.New("Workspace snapshot " + cmd.UID + " not found. ")
		}
		return nil
	})

	return &exploreWorkspaceSnapshot, snapshotError
}

func (s *ExploreWorkspacesService) GetExploreWorkspaceSnapshots(ctx context.Context, cmd GetExploreWorkspaceSnapshotsCommand) ([]ExploreWorkspaceSnapshot, error) {
	exploreWorkspaceSnapshots := make([]ExploreWorkspaceSnapshot, 0)

	queryError := s.SQLStore.WithTransactionalDbSession(ctx, func(session *db.Session) error {
		err := session.Find(&exploreWorkspaceSnapshots, &ExploreWorkspaceSnapshot{ExploreWorspaceUID: cmd.ExploreWorkspaceUID})
		if err != nil {
			return err
		}
		return nil
	})

	if queryError != nil {
		return exploreWorkspaceSnapshots, errors.New("Getting explore workspace snapshots failed. " + queryError.Error())
	}

	return exploreWorkspaceSnapshots, nil
}

func (s *ExploreWorkspacesService) createExploreWorkspaceSnapshot(session *db.Session, ctx context.Context, cmd CreateExploreWorkspaceSnapshotCommand) (ExploreWorkspaceSnapshot, error) {
	uid := util.GenerateShortUID()

	exploreWorkspaceSnapshot := ExploreWorkspaceSnapshot{
		UID:                uid,
		ExploreWorspaceUID: cmd.ExploreWorspaceUID,
		Name:               cmd.Name,
		Description:        cmd.Description,
		Config:             cmd.Config,
		Created:            cmd.Created,
		Updated:            cmd.Updated,
		UserId:             cmd.UserId,
		Version:            1,
	}

	_, storingError := session.Insert(exploreWorkspaceSnapshot)
	return exploreWorkspaceSnapshot, storingError
}

func (s *ExploreWorkspacesService) getExploreWorkspaceSnapshot(ctx context.Context, cmd GetExploreWorkspaceSnapshotCommand) (ExploreWorkspaceSnapshot, error) {
	exploreWorkspaceSnapshot := &ExploreWorkspaceSnapshot{
		UID: cmd.UID,
	}

	queryError := s.SQLStore.WithDbSession(ctx, func(session *db.Session) error {
		has, err := session.Get(exploreWorkspaceSnapshot)
		if err != nil {
			return err
		}
		if !has {
			return errors.New("Workspace snapshot" + cmd.UID + " not found. ")
		}
		return nil
	})

	if queryError != nil {
		return *exploreWorkspaceSnapshot, errors.New("Getting the explore workspace snapshot" + cmd.UID + " failed. " + queryError.Error())
	}

	return *exploreWorkspaceSnapshot, nil
}

func (s *ExploreWorkspacesService) updateExploreWorkspaceSnapshot(ctx context.Context, cmd UpdateExploreWorkspaceSnapshotCommand) (*ExploreWorkspaceSnapshot, error) {
	currentSnapshot, queryError := s.getExploreWorkspaceSnapshot(ctx, GetExploreWorkspaceSnapshotCommand{UID: cmd.UID})
	if queryError != nil {
		return nil, queryError
	}

	exploreWorkspaceSnapshot := ExploreWorkspaceSnapshot{
		UID:         cmd.UID,
		Name:        cmd.Name,
		Description: cmd.Description,
		Updated:     cmd.Updated,
		UserId:      cmd.UserId,
		Config:      cmd.Config,
		Version:     currentSnapshot.Version, // automatically incremented
	}

	updateError := s.SQLStore.WithTransactionalDbSession(ctx, func(session *db.Session) error {
		updated, err := session.ID(cmd.UID).Cols("name", "description", "updated", "user_id", "config", "version").Update(&exploreWorkspaceSnapshot)
		if err != nil {
			return err
		}
		if updated == 0 {
			return errors.New("no snapshots updated")
		}
		return nil
	})

	if updateError != nil {
		return nil, errors.New("Cannot update snapshot with id: " + cmd.UID + ". " + updateError.Error())
	}

	currentSnapshot, queryError = s.getExploreWorkspaceSnapshot(ctx, GetExploreWorkspaceSnapshotCommand{UID: cmd.UID})
	if queryError != nil {
		return nil, queryError
	}

	return &currentSnapshot, nil
}
