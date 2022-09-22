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

// TODO: remove wrapper around sqlstore
func (s *Service) GetUserOrgList(ctx context.Context, query *org.GetUserOrgListQuery) ([]*org.UserOrgDTO, error) {
	q := &models.GetUserOrgListQuery{
		UserId: query.UserID,
	}
	err := s.sqlStore.GetUserOrgList(ctx, q)
	if err != nil {
		return nil, err
	}
	var result []*org.UserOrgDTO
	for _, orga := range q.Result {
		result = append(result, &org.UserOrgDTO{
			OrgID: orga.OrgId,
			Name:  orga.Name,
			Role:  orga.Role,
		})
	}
	return result, nil
}

func (s *Service) UpdateOrg(ctx context.Context, cmd *org.UpdateOrgCommand) error {
	return s.store.Update(ctx, cmd)
}

// TODO: remove wrapper around sqlstore
func (s *Service) Search(ctx context.Context, query *org.SearchOrgsQuery) ([]*org.OrgDTO, error) {
	var res []*org.OrgDTO
	q := &models.SearchOrgsQuery{
		Query: query.Query,
		Name:  query.Name,
		Limit: query.Limit,
		Page:  query.Page,
		Ids:   query.IDs,
	}
	err := s.sqlStore.SearchOrgs(ctx, q)
	if err != nil {
		return nil, err
	}

	for _, r := range q.Result {
		res = append(res, &org.OrgDTO{
			ID:   r.Id,
			Name: r.Name,
		})
	}
	return res, nil
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

// TODO: remove wrapper around sqlstore
func (s *Service) CreateWithMember(name string, userID int64) (*org.Org, error) {
	orga, err := s.sqlStore.CreateOrgWithMember(name, userID)
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

// TODO: remove wrapper around sqlstore
func (s *Service) Create(ctx context.Context, cmd *org.CreateOrgCommand) (*org.Org, error) {
	q := &models.CreateOrgCommand{
		Name:   cmd.Name,
		UserId: cmd.UserID,
	}
	err := s.sqlStore.CreateOrg(ctx, q)
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
