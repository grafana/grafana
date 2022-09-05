package userimpl

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/services/teamguardian"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/userauth"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"

	"golang.org/x/sync/errgroup"
)

type Service struct {
	store              store
	orgService         org.Service
	starService        star.Service
	dashboardService   dashboards.DashboardService
	preferenceService  pref.Service
	teamMemberService  teamguardian.TeamGuardian
	userAuthService    userauth.Service
	quotaService       quota.Service
	accessControlStore accesscontrol.Service
	// TODO remove sqlstore
	sqlStore *sqlstore.SQLStore

	cfg *setting.Cfg
}

func ProvideService(
	db db.DB,
	orgService org.Service,
	starService star.Service,
	dashboardService dashboards.DashboardService,
	preferenceService pref.Service,
	teamMemberService teamguardian.TeamGuardian,
	userAuthService userauth.Service,
	quotaService quota.Service,
	accessControlStore accesscontrol.Service,
	cfg *setting.Cfg,
	ss *sqlstore.SQLStore,
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
		cfg:                cfg,
		sqlStore:           ss,
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
	if err != nil && !errors.Is(err, user.ErrUserNotFound) {
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
			Role:    org.RoleAdmin,
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
			err := s.store.Delete(ctx, userID)
			return usr, err
		}
	}

	return usr, nil
}

func (s *Service) Delete(ctx context.Context, cmd *user.DeleteUserCommand) error {
	_, err := s.store.GetNotServiceAccount(ctx, cmd.UserID)
	if err != nil {
		return err
	}
	// delete from all the stores
	if err := s.store.Delete(ctx, cmd.UserID); err != nil {
		return err
	}

	g, ctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		if err := s.starService.DeleteByUser(ctx, cmd.UserID); err != nil {
			return err
		}
		return nil
	})
	g.Go(func() error {
		if err := s.orgService.DeleteUserFromAll(ctx, cmd.UserID); err != nil {
			return err
		}
		return nil
	})
	g.Go(func() error {
		if err := s.dashboardService.DeleteACLByUser(ctx, cmd.UserID); err != nil {
			return err
		}
		return nil
	})
	g.Go(func() error {
		if err := s.preferenceService.DeleteByUser(ctx, cmd.UserID); err != nil {
			return err
		}
		return nil
	})
	g.Go(func() error {
		if err := s.teamMemberService.DeleteByUser(ctx, cmd.UserID); err != nil {
			return err
		}
		return nil
	})
	g.Go(func() error {
		if err := s.userAuthService.Delete(ctx, cmd.UserID); err != nil {
			return err
		}
		return nil
	})
	g.Go(func() error {
		if err := s.userAuthService.DeleteToken(ctx, cmd.UserID); err != nil {
			return err
		}
		return nil
	})
	g.Go(func() error {
		if err := s.quotaService.DeleteByUser(ctx, cmd.UserID); err != nil {
			return err
		}
		return nil
	})
	g.Go(func() error {
		if err := s.accessControlStore.DeleteUserPermissions(ctx, accesscontrol.GlobalOrgID, cmd.UserID); err != nil {
			return err
		}
		return nil
	})
	if err := g.Wait(); err != nil {
		return err
	}

	return nil
}

func (s *Service) GetByID(ctx context.Context, query *user.GetUserByIDQuery) (*user.User, error) {
	user, err := s.store.GetByID(ctx, query.ID)
	if err != nil {
		return nil, err
	}
	if s.cfg.CaseInsensitiveLogin {
		if err := s.store.CaseInsensitiveLoginConflict(ctx, user.Login, user.Email); err != nil {
			return nil, err
		}
	}
	return user, nil
}

//  TODO: remove wrapper around sqlstore
func (s *Service) GetByLogin(ctx context.Context, query *user.GetUserByLoginQuery) (*user.User, error) {
	q := models.GetUserByLoginQuery{LoginOrEmail: query.LoginOrEmail}
	err := s.sqlStore.GetUserByLogin(ctx, &q)
	if err != nil {
		return nil, err
	}
	return q.Result, nil
}

//  TODO: remove wrapper around sqlstore
func (s *Service) GetByEmail(ctx context.Context, query *user.GetUserByEmailQuery) (*user.User, error) {
	q := models.GetUserByEmailQuery{Email: query.Email}
	err := s.sqlStore.GetUserByEmail(ctx, &q)
	if err != nil {
		return nil, err
	}
	return q.Result, nil
}

//  TODO: remove wrapper around sqlstore
func (s *Service) Update(ctx context.Context, cmd *user.UpdateUserCommand) error {
	q := &models.UpdateUserCommand{
		Name:   cmd.Name,
		Email:  cmd.Email,
		Login:  cmd.Login,
		Theme:  cmd.Theme,
		UserId: cmd.UserID,
	}
	return s.sqlStore.UpdateUser(ctx, q)
}

//  TODO: remove wrapper around sqlstore
func (s *Service) ChangePassword(ctx context.Context, cmd *user.ChangeUserPasswordCommand) error {
	q := &models.ChangeUserPasswordCommand{
		UserId:      cmd.UserID,
		NewPassword: cmd.NewPassword,
		OldPassword: cmd.OldPassword,
	}
	return s.sqlStore.ChangeUserPassword(ctx, q)
}

//  TODO: remove wrapper around sqlstore
func (s *Service) UpdateLastSeenAt(ctx context.Context, cmd *user.UpdateUserLastSeenAtCommand) error {
	q := &models.UpdateUserLastSeenAtCommand{
		UserId: cmd.UserID,
	}
	return s.sqlStore.UpdateUserLastSeenAt(ctx, q)
}

//  TODO: remove wrapper around sqlstore
func (s *Service) SetUsingOrg(ctx context.Context, cmd *user.SetUsingOrgCommand) error {
	q := &models.SetUsingOrgCommand{
		UserId: cmd.UserID,
		OrgId:  cmd.OrgID,
	}
	return s.sqlStore.SetUsingOrg(ctx, q)
}

//  TODO: remove wrapper around sqlstore
func (s *Service) GetSignedInUserWithCacheCtx(ctx context.Context, query *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
	q := &models.GetSignedInUserQuery{
		UserId: query.UserID,
		Login:  query.Login,
		Email:  query.Email,
		OrgId:  query.OrgID,
	}
	err := s.sqlStore.GetSignedInUserWithCacheCtx(ctx, q)
	if err != nil {
		return nil, err
	}
	return q.Result, nil
}

//  TODO: remove wrapper around sqlstore
func (s *Service) GetSignedInUser(ctx context.Context, query *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
	q := &models.GetSignedInUserQuery{
		UserId: query.UserID,
		Login:  query.Login,
		Email:  query.Email,
		OrgId:  query.OrgID,
	}
	err := s.sqlStore.GetSignedInUser(ctx, q)
	if err != nil {
		return nil, err
	}
	return q.Result, nil
}

//  TODO: remove wrapper around sqlstore
func (s *Service) Search(ctx context.Context, query *user.SearchUsersQuery) (*user.SearchUserQueryResult, error) {
	var usrSeschHitDTOs []*user.UserSearchHitDTO
	q := &models.SearchUsersQuery{
		SignedInUser: query.SignedInUser,
		Query:        query.Query,
		OrgId:        query.OrgID,
		Page:         query.Page,
		Limit:        query.Limit,
		AuthModule:   query.AuthModule,
		Filters:      query.Filters,
		IsDisabled:   query.IsDisabled,
	}
	err := s.sqlStore.SearchUsers(ctx, q)
	if err != nil {
		return nil, err
	}
	for _, usrSearch := range q.Result.Users {
		usrSeschHitDTOs = append(usrSeschHitDTOs, &user.UserSearchHitDTO{
			ID:            usrSearch.Id,
			Login:         usrSearch.Login,
			Email:         usrSearch.Email,
			Name:          usrSearch.Name,
			AvatarUrl:     usrSearch.AvatarUrl,
			IsDisabled:    usrSearch.IsDisabled,
			IsAdmin:       usrSearch.IsAdmin,
			LastSeenAt:    usrSearch.LastSeenAt,
			LastSeenAtAge: usrSearch.LastSeenAtAge,
			AuthLabels:    usrSearch.AuthLabels,
			AuthModule:    user.AuthModuleConversion(usrSearch.AuthModule),
		})
	}

	res := &user.SearchUserQueryResult{
		Users:      usrSeschHitDTOs,
		TotalCount: q.Result.TotalCount,
		Page:       q.Result.Page,
		PerPage:    q.Result.PerPage,
	}
	return res, nil
}

//  TODO: remove wrapper around sqlstore
func (s *Service) Disable(ctx context.Context, cmd *user.DisableUserCommand) error {
	q := &models.DisableUserCommand{
		UserId:     cmd.UserID,
		IsDisabled: cmd.IsDisabled,
	}
	return s.sqlStore.DisableUser(ctx, q)
}

//  TODO: remove wrapper around sqlstore
func (s *Service) BatchDisableUsers(ctx context.Context, cmd *user.BatchDisableUsersCommand) error {
	c := &models.BatchDisableUsersCommand{
		UserIds:    cmd.UserIDs,
		IsDisabled: cmd.IsDisabled,
	}
	return s.sqlStore.BatchDisableUsers(ctx, c)
}

//  TODO: remove wrapper around sqlstore
func (s *Service) UpdatePermissions(userID int64, isAdmin bool) error {
	return s.sqlStore.UpdateUserPermissions(userID, isAdmin)
}

//  TODO: remove wrapper around sqlstore
func (s *Service) SetUserHelpFlag(ctx context.Context, cmd *user.SetUserHelpFlagCommand) error {
	c := &models.SetUserHelpFlagCommand{
		UserId:     cmd.UserID,
		HelpFlags1: cmd.HelpFlags1,
	}
	return s.sqlStore.SetUserHelpFlag(ctx, c)
}

//  TODO: remove wrapper around sqlstore
func (s *Service) GetUserProfile(ctx context.Context, query *user.GetUserProfileQuery) (user.UserProfileDTO, error) {
	q := &models.GetUserProfileQuery{
		UserId: query.UserID,
	}
	err := s.sqlStore.GetUserProfile(ctx, q)
	if err != nil {
		return user.UserProfileDTO{}, err
	}
	result := user.UserProfileDTO{
		ID:             q.Result.Id,
		Email:          q.Result.Email,
		Name:           q.Result.Name,
		Login:          q.Result.Login,
		Theme:          q.Result.Theme,
		OrgID:          q.Result.OrgId,
		IsGrafanaAdmin: q.Result.IsGrafanaAdmin,
		IsDisabled:     q.Result.IsDisabled,
		IsExternal:     q.Result.IsExternal,
		AuthLabels:     q.Result.AuthLabels,
		UpdatedAt:      q.Result.UpdatedAt,
		CreatedAt:      q.Result.CreatedAt,
		AvatarUrl:      q.Result.AvatarUrl,
		AccessControl:  q.Result.AccessControl,
	}
	return result, nil
}
