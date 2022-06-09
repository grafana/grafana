package userimpl

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type Service struct {
	store      store
	orgService org.Service
}

func ProvideService(db db.DB) user.Service {
	return &Service{
		store: &sqlStore{
			db: db,
		},
	}
}

func (s *Service) Create(ctx context.Context, cmd *user.CreateUserCommand) (*user.User, error) {
	orgID, err := s.orgService.GetIDForNewUser(*cmd)
	if err != nil {
		return nil, err
	}

	if cmd.Email == "" {
		cmd.Email = cmd.Login
	}
	cmd.OrgID = orgID
	usr, err := s.store.Get(ctx, cmd)
	if err != nil {
		return nil, err
	}

	salt, err := util.GetRandomString(10)
	if err != nil {
		return nil, err
	}
	usr.Salt = salt
	rands, err := util.GetRandomString(10)
	if err != nil {
		return nil, err
	}
	usr.Rands = rands

	if len(cmd.Password) > 0 {
		encodedPassword, err := util.EncodePassword(cmd.Password, usr.Salt)
		if err != nil {
			return nil, err
		}
		usr.Password = encodedPassword
	}

	err = s.store.Create(ctx, cmd)
	if err != nil {
		return nil, err
	}

	// create org user link
	if !cmd.SkipOrgSetup {
		orgUser := models.OrgUser{
			OrgId:   orgID,
			UserId:  usr.ID,
			Role:    models.ROLE_ADMIN,
			Created: time.Now(),
			Updated: time.Now(),
		}

		if setting.AutoAssignOrg && !usr.IsAdmin {
			if len(cmd.DefaultOrgRole) > 0 {
				orgUser.Role = models.RoleType(cmd.DefaultOrgRole)
			} else {
				orgUser.Role = models.RoleType(setting.AutoAssignOrgRole)
			}
		}
		err = s.store.Insert(ctx, &orgUser)
		if err != nil {
			return nil, err
		}
	}

	return usr, nil
}
