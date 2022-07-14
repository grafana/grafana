package userimpl

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/services/teamguardian/manager"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/userauth"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type Service struct {
	store              store
	orgService         org.Service
	starService        star.Service
	dashboardService   dashboards.DashboardService
	preferenceService  pref.Service
	teamMemberService  *manager.Service
	userAuthService    userauth.Service
	quotaService       quota.Service
	accessControlStore *database.AccessControlStore
}

func ProvideService(
	db db.DB,
	orgService org.Service,
	starService star.Service,
	dashboardService dashboards.DashboardService,
	preferenceService pref.Service,
	teamMemberService *manager.Service,
	userAuthService userauth.Service,
	quotaService quota.Service,
	accessControlStore *database.AccessControlStore,
) user.Service {
	return &Service{
		store: &sqlStore{
			db:      db,
			dialect: db.GetDialect(),
		},
		orgService:         orgService,
		starService:        starService,
		dashboardService:   dashboardService,
		preferenceService:  preferenceService,
		teamMemberService:  teamMemberService,
		userAuthService:    userAuthService,
		quotaService:       quotaService,
		accessControlStore: accessControlStore,
	}
}

func (s *Service) Create(ctx context.Context, cmd *user.CreateUserCommand) (*user.User, error) {
	cmdOrg := org.GetOrgIDForNewUserCommand{
		Email:        cmd.Email,
		Login:        cmd.Login,
		OrgID:        cmd.OrgID,
		OrgName:      cmd.OrgName,
		SkipOrgSetup: cmd.SkipOrgSetup,
	}
	orgID, err := s.orgService.GetIDForNewUser(ctx, cmdOrg)
	cmd.OrgID = orgID
	if err != nil {
		return nil, err
	}

	if cmd.Email == "" {
		cmd.Email = cmd.Login
	}
	usr := &user.User{
		Login: cmd.Login,
		Email: cmd.Email,
	}
	usr, err = s.store.Get(ctx, usr)
	if err != nil && !errors.Is(err, models.ErrUserNotFound) {
		return usr, err
	}

	// create user
	usr = &user.User{
		Email:            cmd.Email,
		Name:             cmd.Name,
		Login:            cmd.Login,
		Company:          cmd.Company,
		IsAdmin:          cmd.IsAdmin,
		IsDisabled:       cmd.IsDisabled,
		OrgID:            cmd.OrgID,
		EmailVerified:    cmd.EmailVerified,
		Created:          time.Now(),
		Updated:          time.Now(),
		LastSeenAt:       time.Now().AddDate(-10, 0, 0),
		IsServiceAccount: cmd.IsServiceAccount,
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

	userID, err := s.store.Insert(ctx, usr)
	if err != nil {
		return nil, err
	}

	// create org user link
	if !cmd.SkipOrgSetup {
		orgUser := org.OrgUser{
			OrgID:   orgID,
			UserID:  usr.ID,
			Role:    org.ROLE_ADMIN,
			Created: time.Now(),
			Updated: time.Now(),
		}

		if setting.AutoAssignOrg && !usr.IsAdmin {
			if len(cmd.DefaultOrgRole) > 0 {
				orgUser.Role = org.RoleType(cmd.DefaultOrgRole)
			} else {
				orgUser.Role = org.RoleType(setting.AutoAssignOrgRole)
			}
		}
		_, err = s.orgService.InsertOrgUser(ctx, &orgUser)
		if err != nil {
			s.store.Delete(ctx, userID)
			return usr, err
		}
	}

	return usr, nil
}

func (s *Service) Delete(ctx context.Context, cmd *user.DeleteUserCommand) error {
	_, err := s.store.ExistNotServiceAccount(ctx, cmd.UserID)
	if err != nil {
		return err
	}
	// delete from all the stores
	if err := s.store.Delete(ctx, cmd.UserID); err != nil {
		return err
	}
	if err := s.starService.DeleteByUser(ctx, cmd.UserID); err != nil {
		fmt.Printf("failed to delete star for user with ID %v: %v", cmd.UserID, err)
	}
	if err := s.orgService.DeleteOrgUser(ctx, cmd.UserID); err != nil {
		return err
	}
	if err := s.dashboardService.DeleteAclByUser(ctx, cmd.UserID); err != nil {
		return err
	}
	if err := s.preferenceService.DeleteByUser(ctx, cmd.UserID); err != nil {
		return err
	}
	if err := s.teamMemberService.DeleteByUser(ctx, cmd.UserID); err != nil {
		return err
	}
	if err := s.userAuthService.Delete(ctx, cmd.UserID); err != nil {
		return err
	}
	if err := s.userAuthService.DeleteToken(ctx, cmd.UserID); err != nil {
		return err
	}
	if err := s.quotaService.DeleteByUser(ctx, cmd.UserID); err != nil {
		return err
	}
	if err := s.accessControlStore.DeleteUserPermissions(ctx, cmd.UserID); err != nil {
		return err
	}
	return nil
}
