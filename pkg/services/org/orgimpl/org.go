package orgimpl

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type Service struct {
	store store
	cfg   *setting.Cfg
	log   log.Logger
	// TODO remove sqlstore and use db.DB
	sqlStore sqlstore.Store
}

func ProvideService(db sqlstore.Store, cfg *setting.Cfg) org.Service {
	return &Service{
		store: &sqlStore{
			db:      db,
			dialect: db.GetDialect(),
		},
		cfg:      cfg,
		log:      log.New("org service"),
		sqlStore: db,
	}
}

func (s *Service) GetIDForNewUser(ctx context.Context, cmd org.GetOrgIDForNewUserCommand) (int64, error) {
	var orga org.Org
	if cmd.SkipOrgSetup {
		return -1, nil
	}

	if setting.AutoAssignOrg && cmd.OrgID != 0 {
		_, err := s.store.Get(ctx, cmd.OrgID)
		if err != nil {
			return -1, err
		}
		return cmd.OrgID, nil
	}

	orgName := cmd.OrgName
	if len(orgName) == 0 {
		orgName = util.StringsFallback2(cmd.Email, cmd.Login)
	}

	if setting.AutoAssignOrg {
		orga, err := s.store.Get(ctx, int64(s.cfg.AutoAssignOrgId))
		if err != nil {
			return 0, err
		}
		if orga.ID != 0 {
			return orga.ID, nil
		}
		if setting.AutoAssignOrgId != 1 {
			s.log.Error("Could not create user: organization ID does not exist", "orgID",
				setting.AutoAssignOrgId)
			return 0, fmt.Errorf("could not create user: organization ID %d does not exist",
				setting.AutoAssignOrgId)
		}
		orga.Name = MainOrgName
		orga.ID = int64(setting.AutoAssignOrgId)
	} else {
		orga.Name = orgName
	}
	orga.Created = time.Now()
	orga.Updated = time.Now()

	return s.store.Insert(ctx, &orga)
}

func (s *Service) InsertOrgUser(ctx context.Context, orguser *org.OrgUser) (int64, error) {
	return s.store.InsertOrgUser(ctx, orguser)
}

func (s *Service) DeleteUserFromAll(ctx context.Context, userID int64) error {
	return s.store.DeleteUserFromAll(ctx, userID)
}

// TODO: refactor service to call store CRUD method
func (s *Service) GetUserOrgList(ctx context.Context, query *org.GetUserOrgListQuery) ([]*org.UserOrgDTO, error) {
	return s.store.GetUserOrgList(ctx, query)
}

// TODO: refactor service to call store CRUD method
func (s *Service) UpdateOrg(ctx context.Context, cmd *org.UpdateOrgCommand) error {
	return s.store.Update(ctx, cmd)
}

// TODO: refactor service to call store CRUD method
func (s *Service) Search(ctx context.Context, query *org.SearchOrgsQuery) ([]*org.OrgDTO, error) {
	return s.store.Search(ctx, query)
}

// TODO: remove wrapper around sqlstore
func (s *Service) GetByID(ctx context.Context, query *org.GetOrgByIdQuery) (*org.Org, error) {
	q := &models.GetOrgByIdQuery{Id: query.ID}
	err := s.sqlStore.GetOrgById(ctx, q)
	if err != nil {
		return nil, err
	}
	return &org.Org{
		ID:       q.Result.Id,
		Version:  q.Result.Version,
		Name:     q.Result.Name,
		Address1: q.Result.Address1,
		Address2: q.Result.Address2,
		City:     q.Result.City,
		ZipCode:  q.Result.ZipCode,
		State:    q.Result.State,
		Country:  q.Result.Country,
		Created:  q.Result.Created,
		Updated:  q.Result.Updated,
	}, nil
}

// TODO: remove wrapper around sqlstore
func (s *Service) GetByNameHandler(ctx context.Context, query *org.GetOrgByNameQuery) (*org.Org, error) {
	q := &models.GetOrgByNameQuery{Name: query.Name}
	err := s.sqlStore.GetOrgByNameHandler(ctx, q)
	if err != nil {
		return nil, err
	}
	return &org.Org{
		ID:       q.Result.Id,
		Version:  q.Result.Version,
		Name:     q.Result.Name,
		Address1: q.Result.Address1,
		Address2: q.Result.Address2,
		City:     q.Result.City,
		ZipCode:  q.Result.ZipCode,
		State:    q.Result.State,
		Country:  q.Result.Country,
		Created:  q.Result.Created,
		Updated:  q.Result.Updated,
	}, nil
}

// TODO: remove wrapper around sqlstore
func (s *Service) GetByName(name string) (*org.Org, error) {
	orga, err := s.sqlStore.GetOrgByName(name)
	if err != nil {
		return nil, err
	}
	return &org.Org{
		ID:       orga.Id,
		Version:  orga.Version,
		Name:     orga.Name,
		Address1: orga.Address1,
		Address2: orga.Address2,
		City:     orga.City,
		ZipCode:  orga.ZipCode,
		State:    orga.State,
		Country:  orga.Country,
		Created:  orga.Created,
		Updated:  orga.Updated,
	}, nil
}

// TODO: refactor service to call store CRUD method
func (s *Service) CreateWithMember(ctx context.Context, cmd *org.CreateOrgCommand) (*org.Org, error) {
	return s.store.CreateWithMember(ctx, cmd)
}

// TODO: refactor service to call store CRUD method
func (s *Service) UpdateAddress(ctx context.Context, cmd *org.UpdateOrgAddressCommand) error {
	return s.store.UpdateAddress(ctx, cmd)
}

// TODO: refactor service to call store CRUD method
func (s *Service) Delete(ctx context.Context, cmd *org.DeleteOrgCommand) error {
	return s.store.Delete(ctx, cmd)
}

func (s *Service) GetOrCreate(ctx context.Context, orgName string) (int64, error) {
	var orga *org.Org
	var err error
	if s.cfg.AutoAssignOrg {
		orga, err = s.store.Get(ctx, int64(s.cfg.AutoAssignOrgId))
		if err != nil {
			return 0, err
		}

		if s.cfg.AutoAssignOrgId != 1 {
			s.log.Error("Could not create user: organization ID does not exist", "orgID",
				s.cfg.AutoAssignOrgId)
			return 0, fmt.Errorf("could not create user: organization ID %d does not exist",
				s.cfg.AutoAssignOrgId)
		}

		orga.Name = MainOrgName
		orga.ID = int64(s.cfg.AutoAssignOrgId)
	} else {
		orga.Name = orgName
	}

	orga.Created = time.Now()
	orga.Updated = time.Now()

	_, err = s.store.Insert(ctx, orga)
	if err != nil {
		return 0, err
	}
	return orga.ID, nil
}

// TODO: remove wrapper around sqlstore
func (s *Service) AddOrgUser(ctx context.Context, cmd *org.AddOrgUserCommand) error {
	c := &models.AddOrgUserCommand{
		LoginOrEmail:              cmd.LoginOrEmail,
		OrgId:                     cmd.OrgID,
		UserId:                    cmd.UserID,
		Role:                      cmd.Role,
		AllowAddingServiceAccount: cmd.AllowAddingServiceAccount,
	}
	return s.sqlStore.AddOrgUser(ctx, c)
}

// TODO: remove wrapper around sqlstore
func (s *Service) UpdateOrgUser(ctx context.Context, cmd *org.UpdateOrgUserCommand) error {
	c := &models.UpdateOrgUserCommand{
		UserId: cmd.UserID,
		OrgId:  cmd.OrgID,
		Role:   cmd.Role,
	}
	return s.sqlStore.UpdateOrgUser(ctx, c)
}

// TODO: remove wrapper around sqlstore
func (s *Service) RemoveOrgUser(ctx context.Context, cmd *org.RemoveOrgUserCommand) error {
	c := &models.RemoveOrgUserCommand{
		UserId:                   cmd.UserID,
		OrgId:                    cmd.OrgID,
		ShouldDeleteOrphanedUser: cmd.ShouldDeleteOrphanedUser,
		UserWasDeleted:           cmd.UserWasDeleted,
	}
	return s.sqlStore.RemoveOrgUser(ctx, c)
}

// TODO: remove wrapper around sqlstore
func (s *Service) GetOrgUsers(ctx context.Context, query *org.GetOrgUsersQuery) ([]*org.OrgUserDTO, error) {
	q := &models.GetOrgUsersQuery{
		UserID:                   query.UserID,
		OrgId:                    query.OrgID,
		Query:                    query.Query,
		Limit:                    query.Limit,
		DontEnforceAccessControl: query.DontEnforceAccessControl,
		User:                     query.User,
	}
	err := s.sqlStore.GetOrgUsers(ctx, q)
	if err != nil {
		return nil, err
	}

	result := make([]*org.OrgUserDTO, 0)
	for _, user := range q.Result {
		result = append(result, &org.OrgUserDTO{
			OrgID:         user.OrgId,
			UserID:        user.UserId,
			Login:         user.Login,
			Email:         user.Email,
			Name:          user.Name,
			AvatarURL:     user.AvatarUrl,
			Role:          user.Role,
			LastSeenAt:    user.LastSeenAt,
			LastSeenAtAge: user.LastSeenAtAge,
			Updated:       user.Updated,
			Created:       user.Created,
			AccessControl: user.AccessControl,
			IsDisabled:    user.IsDisabled,
		})
	}
	return result, nil
}

// TODO: remove wrapper around sqlstore
func (s *Service) SearchOrgUsers(ctx context.Context, query *org.SearchOrgUsersQuery) (*org.SearchOrgUsersQueryResult, error) {
	q := &models.SearchOrgUsersQuery{
		OrgID: query.OrgID,
		Query: query.Query,
		Page:  query.Page,
		Limit: query.Limit,
		User:  query.User,
	}
	err := s.sqlStore.SearchOrgUsers(ctx, q)
	if err != nil {
		return nil, err
	}

	result := &org.SearchOrgUsersQueryResult{
		TotalCount: q.Result.TotalCount,
		OrgUsers:   make([]*org.OrgUserDTO, 0),
		Page:       q.Result.Page,
		PerPage:    q.Result.PerPage,
	}

	for _, user := range q.Result.OrgUsers {
		result.OrgUsers = append(result.OrgUsers, &org.OrgUserDTO{
			OrgID:         user.OrgId,
			UserID:        user.UserId,
			Login:         user.Login,
			Email:         user.Email,
			Name:          user.Name,
			AvatarURL:     user.AvatarUrl,
			Role:          user.Role,
			LastSeenAt:    user.LastSeenAt,
			LastSeenAtAge: user.LastSeenAtAge,
			Updated:       user.Updated,
			Created:       user.Created,
			AccessControl: user.AccessControl,
			IsDisabled:    user.IsDisabled,
		})
	}
	return result, nil
}
