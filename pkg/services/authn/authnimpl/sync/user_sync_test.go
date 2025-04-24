package sync

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfoimpl"
	"github.com/grafana/grafana/pkg/services/login/authinfotest"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
)

func ptrString(s string) *string {
	return &s
}

func ptrBool(b bool) *bool {
	return &b
}

func TestUserSync_SyncUserHook(t *testing.T) {
	userProtection := &authinfoimpl.OSSUserProtectionImpl{}

	authFakeNil := &authinfotest.FakeService{
		ExpectedError: user.ErrUserNotFound,
		SetAuthInfoFn: func(ctx context.Context, cmd *login.SetAuthInfoCommand) error {
			return nil
		},
		UpdateAuthInfoFn: func(ctx context.Context, cmd *login.UpdateAuthInfoCommand) error {
			return nil
		},
	}
	authFakeUserID := &authinfotest.FakeService{
		ExpectedError: nil,
		ExpectedUserAuth: &login.UserAuth{
			AuthModule: "oauth",
			AuthId:     "2032",
			UserId:     1,
			Id:         1,
		},
	}

	userService := &usertest.FakeUserService{ExpectedUser: &user.User{
		ID:    1,
		UID:   "1",
		Login: "test",
		Name:  "test",
		Email: "test",
	}}

	userServiceMod := &usertest.FakeUserService{ExpectedUser: &user.User{
		ID:         3,
		UID:        "3",
		Login:      "test",
		Name:       "test",
		Email:      "test",
		IsDisabled: true,
		IsAdmin:    false,
	}}

	userServiceEmailMod := &usertest.FakeUserService{ExpectedUser: &user.User{
		ID:            3,
		UID:           "3",
		Login:         "test",
		Name:          "test",
		Email:         "test@test.com",
		EmailVerified: true,
		IsDisabled:    true,
		IsAdmin:       false,
	}}

	userServiceNil := &usertest.FakeUserService{
		ExpectedError: user.ErrUserNotFound,
		CreateFn: func(ctx context.Context, cmd *user.CreateUserCommand) (*user.User, error) {
			return &user.User{
				ID:      2,
				UID:     "2",
				Login:   cmd.Login,
				Name:    cmd.Name,
				Email:   cmd.Email,
				IsAdmin: cmd.IsAdmin,
			}, nil
		},
	}

	type fields struct {
		userService     user.Service
		authInfoService login.AuthInfoService
		quotaService    quota.Service
	}
	type args struct {
		ctx context.Context
		id  *authn.Identity
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		wantErr bool
		wantID  *authn.Identity
	}{
		{
			name: "no sync",
			fields: fields{
				userService:     userService,
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					Login: "test",
					Name:  "test",
					Email: "test",
					ClientParams: authn.ClientParams{
						LookUpParams: login.UserLookupParams{
							Email: ptrString("test"),
							Login: nil,
						},
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				Login: "test",
				Name:  "test",
				Email: "test",
				ClientParams: authn.ClientParams{
					LookUpParams: login.UserLookupParams{
						Email: ptrString("test"),
						Login: nil,
					},
				},
			},
		},
		{
			name: "sync - user found in DB - by email",
			fields: fields{
				userService:     userService,
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					Login: "test",
					Name:  "test",
					Email: "test",
					ClientParams: authn.ClientParams{
						SyncUser: true,
						LookUpParams: login.UserLookupParams{
							Email: ptrString("test"),
							Login: nil,
						},
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:             "1",
				UID:            "1",
				Type:           claims.TypeUser,
				Login:          "test",
				Name:           "test",
				Email:          "test",
				IsGrafanaAdmin: ptrBool(false),
				ClientParams: authn.ClientParams{
					SyncUser: true,
					LookUpParams: login.UserLookupParams{
						Email: ptrString("test"),
						Login: nil,
					},
				},
			},
		},
		{
			name: "sync - user found in DB - by login",
			fields: fields{
				userService:     userService,
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					Login: "test",
					Name:  "test",
					Email: "test",
					ClientParams: authn.ClientParams{
						SyncUser: true,
						LookUpParams: login.UserLookupParams{
							Email: nil,
							Login: ptrString("test"),
						},
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:             "1",
				UID:            "1",
				Type:           claims.TypeUser,
				Login:          "test",
				Name:           "test",
				Email:          "test",
				IsGrafanaAdmin: ptrBool(false),
				ClientParams: authn.ClientParams{
					LookUpParams: login.UserLookupParams{
						Email: nil,
						Login: ptrString("test"),
					},
					SyncUser: true,
				},
			},
		},
		{
			name: "sync - user found in authInfo",
			fields: fields{
				userService:     userService,
				authInfoService: authFakeUserID,
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					AuthID:          "2032",
					AuthenticatedBy: "oauth",
					Login:           "test",
					Name:            "test",
					Email:           "test",
					ClientParams: authn.ClientParams{
						SyncUser: true,
						LookUpParams: login.UserLookupParams{
							Email: nil,
							Login: nil,
						},
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:              "1",
				UID:             "1",
				Type:            claims.TypeUser,
				AuthID:          "2032",
				AuthenticatedBy: "oauth",
				Login:           "test",
				Name:            "test",
				Email:           "test",
				IsGrafanaAdmin:  ptrBool(false),
				ClientParams: authn.ClientParams{
					SyncUser: true,
					LookUpParams: login.UserLookupParams{
						Email: nil,
						Login: nil,
					},
				},
			},
		},
		{
			name: "sync - user needs to be created - disabled signup",
			fields: fields{
				userService:     userService,
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					Login:           "test",
					Name:            "test",
					Email:           "test",
					AuthenticatedBy: "oauth",
					AuthID:          "2032",
					ClientParams: authn.ClientParams{
						SyncUser: true,
						LookUpParams: login.UserLookupParams{
							Email: nil,
							Login: nil,
						},
					},
				},
			},
			wantErr: true,
		},
		{
			name: "sync - user needs to be created - enabled signup",
			fields: fields{
				userService:     userServiceNil,
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					Login:           "test_create",
					Name:            "test_create",
					IsGrafanaAdmin:  ptrBool(true),
					Email:           "test_create",
					AuthenticatedBy: "oauth",
					AuthID:          "2032",
					ClientParams: authn.ClientParams{
						SyncUser:    true,
						AllowSignUp: true,
						EnableUser:  true,
						LookUpParams: login.UserLookupParams{
							Email: ptrString("test_create"),
							Login: nil,
						},
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:              "2",
				UID:             "2",
				Type:            claims.TypeUser,
				Login:           "test_create",
				Name:            "test_create",
				Email:           "test_create",
				AuthenticatedBy: "oauth",
				AuthID:          "2032",
				IsGrafanaAdmin:  ptrBool(true),
				ClientParams: authn.ClientParams{
					SyncUser:    true,
					AllowSignUp: true,
					EnableUser:  true,
					LookUpParams: login.UserLookupParams{
						Email: ptrString("test_create"),
						Login: nil,
					},
				},
			},
		},
		{
			name: "sync - needs full update",
			fields: fields{
				userService:     userServiceMod,
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					Login:          "test_mod",
					Name:           "test_mod",
					Email:          "test_mod",
					IsDisabled:     false,
					IsGrafanaAdmin: ptrBool(true),
					ClientParams: authn.ClientParams{
						SyncUser:   true,
						EnableUser: true,
						LookUpParams: login.UserLookupParams{
							Email: nil,
							Login: ptrString("test"),
						},
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:             "3",
				UID:            "3",
				Type:           claims.TypeUser,
				Login:          "test_mod",
				Name:           "test_mod",
				Email:          "test_mod",
				IsDisabled:     false,
				IsGrafanaAdmin: ptrBool(true),
				ClientParams: authn.ClientParams{
					SyncUser:   true,
					EnableUser: true,
					LookUpParams: login.UserLookupParams{
						Email: nil,
						Login: ptrString("test"),
					},
				},
			},
		},
		{
			name: "sync - reset email verified on email change",
			fields: fields{
				userService:     userServiceEmailMod,
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					Login:          "test",
					Name:           "test",
					Email:          "test_mod@test.com",
					EmailVerified:  true,
					IsDisabled:     false,
					IsGrafanaAdmin: ptrBool(true),
					ClientParams: authn.ClientParams{
						SyncUser:   true,
						EnableUser: true,
						LookUpParams: login.UserLookupParams{
							Email: nil,
							Login: ptrString("test"),
						},
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:             "3",
				UID:            "3",
				Type:           claims.TypeUser,
				Name:           "test",
				Login:          "test",
				Email:          "test_mod@test.com",
				IsDisabled:     false,
				EmailVerified:  false,
				IsGrafanaAdmin: ptrBool(true),
				ClientParams: authn.ClientParams{
					SyncUser:   true,
					EnableUser: true,
					LookUpParams: login.UserLookupParams{
						Email: nil,
						Login: ptrString("test"),
					},
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := ProvideUserSync(tt.fields.userService, userProtection, tt.fields.authInfoService, tt.fields.quotaService, tracing.InitializeTracerForTest(), featuremgmt.WithFeatures(), setting.NewCfg())
			err := s.SyncUserHook(tt.args.ctx, tt.args.id, nil)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			require.EqualValues(t, tt.wantID, tt.args.id)
		})
	}
}

func TestUserSync_SyncUserRetryFetch(t *testing.T) {
	userSrv := usertest.NewMockService(t)
	userSrv.On("GetByEmail", mock.Anything, mock.Anything).Return(nil, user.ErrUserNotFound).Once()
	userSrv.On("Create", mock.Anything, mock.Anything).Return(nil, user.ErrUserAlreadyExists).Once()
	userSrv.On("GetByEmail", mock.Anything, mock.Anything).Return(&user.User{ID: 1}, nil).Once()

	s := ProvideUserSync(
		userSrv,
		authinfoimpl.ProvideOSSUserProtectionService(),
		&authinfotest.FakeService{},
		&quotatest.FakeQuotaService{},
		tracing.NewNoopTracerService(),
		featuremgmt.WithFeatures(),
		setting.NewCfg(),
	)

	email := "test@test.com"

	err := s.SyncUserHook(context.Background(), &authn.Identity{
		ClientParams: authn.ClientParams{
			SyncUser:    true,
			AllowSignUp: true,
			LookUpParams: login.UserLookupParams{
				Email: &email,
			},
		},
	}, nil)
	require.NoError(t, err)
}

func TestUserSync_FetchSyncedUserHook(t *testing.T) {
	type testCase struct {
		desc        string
		req         *authn.Request
		identity    *authn.Identity
		expectedErr error
	}

	tests := []testCase{
		{
			desc:     "should skip hook when flag is not enabled",
			req:      &authn.Request{},
			identity: &authn.Identity{ClientParams: authn.ClientParams{FetchSyncedUser: false}},
		},
		{
			desc:     "should skip hook when identity is not a user",
			req:      &authn.Request{},
			identity: &authn.Identity{ID: "1", Type: claims.TypeAPIKey, ClientParams: authn.ClientParams{FetchSyncedUser: true}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			s := UserSync{
				tracer: tracing.InitializeTracerForTest(),
			}
			err := s.FetchSyncedUserHook(context.Background(), tt.identity, tt.req)
			require.ErrorIs(t, err, tt.expectedErr)
		})
	}
}

func TestUserSync_EnableDisabledUserHook(t *testing.T) {
	type testCase struct {
		desc       string
		identity   *authn.Identity
		enableUser bool
	}

	tests := []testCase{
		{
			desc: "should skip if correct flag is not set",
			identity: &authn.Identity{
				ID:           "1",
				Type:         claims.TypeUser,
				IsDisabled:   true,
				ClientParams: authn.ClientParams{EnableUser: false},
			},
			enableUser: false,
		},
		{
			desc: "should skip if identity is not a user",
			identity: &authn.Identity{
				ID:           "1",
				Type:         claims.TypeAPIKey,
				IsDisabled:   true,
				ClientParams: authn.ClientParams{EnableUser: true},
			},
			enableUser: false,
		},
		{
			desc: "should enabled disabled user",
			identity: &authn.Identity{
				ID:           "1",
				Type:         claims.TypeUser,
				IsDisabled:   true,
				ClientParams: authn.ClientParams{EnableUser: true},
			},
			enableUser: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			userSvc := usertest.NewUserServiceFake()
			called := false
			userSvc.UpdateFn = func(ctx context.Context, cmd *user.UpdateUserCommand) error {
				called = true
				return nil
			}

			s := UserSync{userService: userSvc, tracer: tracing.InitializeTracerForTest()}
			err := s.EnableUserHook(context.Background(), tt.identity, nil)
			require.NoError(t, err)
			assert.Equal(t, tt.enableUser, called)
		})
	}
}

func initUserSyncService() *UserSync {
	userSvc := usertest.NewUserServiceFake()
	log := log.New("test")
	authInfoSvc := &authinfotest.FakeService{
		ExpectedUserAuth: &login.UserAuth{
			UserId:     1,
			AuthModule: login.SAMLAuthModule,
			AuthId:     "1",
		},
	}
	quotaSvc := &quotatest.FakeQuotaService{}
	return &UserSync{
		userService:     userSvc,
		authInfoService: authInfoSvc,
		quotaService:    quotaSvc,
		tracer:          tracing.InitializeTracerForTest(),
		log:             log,
	}
}

func TestUserSync_ValidateUserProvisioningHook(t *testing.T) {
	type testCase struct {
		desc                 string
		identity             *authn.Identity
		userSyncServiceSetup func() *UserSync
		expectedErr          error
	}

	tests := []testCase{
		{
			desc: "it should skip validation if the user provisioning is disabled",
			userSyncServiceSetup: func() *UserSync {
				userSyncService := initUserSyncService()
				userSyncService.isUserProvisioningEnabled = false
				return userSyncService
			},
			identity: &authn.Identity{
				AuthenticatedBy: login.GenericOAuthModule,
				AuthID:          "1",
			},
		},
		{
			desc: "it should skip validation if allowedNonProvisionedUsers is enabled",
			userSyncServiceSetup: func() *UserSync {
				userSyncService := initUserSyncService()
				userSyncService.allowNonProvisionedUsers = true
				userSyncService.isUserProvisioningEnabled = true
				return userSyncService
			},
			identity: &authn.Identity{
				AuthenticatedBy: login.GenericOAuthModule,
				AuthID:          "1",
			},
		},
		{
			desc: "it should skip validation if the user is authenticated via GrafanaComAuthModule",
			userSyncServiceSetup: func() *UserSync {
				userSyncService := initUserSyncService()
				userSyncService.allowNonProvisionedUsers = false
				userSyncService.isUserProvisioningEnabled = true
				return userSyncService
			},
			identity: &authn.Identity{
				AuthenticatedBy: login.GrafanaComAuthModule,
				AuthID:          "1",
			},
		},
		{
			desc: "it should fail to validate the identity with the provisioned user, unexpected error",
			userSyncServiceSetup: func() *UserSync {
				userSyncService := initUserSyncService()
				userSyncService.allowNonProvisionedUsers = false
				userSyncService.isUserProvisioningEnabled = true
				userSyncService.userService = &usertest.FakeUserService{
					ExpectedError: errors.New("random error"),
				}
				return userSyncService
			},
			identity: &authn.Identity{
				AuthenticatedBy: login.SAMLAuthModule,
				AuthID:          "1",
				ExternalUID:     "random-external-uid",
			},
			expectedErr: errUnableToRetrieveUserOrAuthInfo.Errorf("unable to retrieve user or authInfo for validation"),
		},
		{
			desc: "it should fail to validate the identity with the provisioned user, no user found",
			userSyncServiceSetup: func() *UserSync {
				userSyncService := initUserSyncService()
				userSyncService.allowNonProvisionedUsers = false
				userSyncService.isUserProvisioningEnabled = true
				userSyncService.userService = &usertest.FakeUserService{}
				return userSyncService
			},
			identity: &authn.Identity{
				AuthenticatedBy: login.SAMLAuthModule,
				AuthID:          "1",
				ExternalUID:     "random-external-uid",
			},
			expectedErr: errUnableToRetrieveUser.Errorf("unable to retrieve user for validation"),
		},
		{
			desc: "it should fail to validate the provisioned user.ExternalUID with the identity.ExternalUID - empty ExternalUID",
			userSyncServiceSetup: func() *UserSync {
				userSyncService := initUserSyncService()
				userSyncService.allowNonProvisionedUsers = false
				userSyncService.isUserProvisioningEnabled = true
				userSyncService.userService = &usertest.FakeUserService{
					ExpectedUser: &user.User{
						ID:            1,
						IsProvisioned: true,
					},
				}
				userSyncService.authInfoService = &authinfotest.FakeService{
					ExpectedUserAuth: &login.UserAuth{
						UserId:     1,
						AuthModule: login.SAMLAuthModule,
						AuthId:     "1",
					},
				}
				return userSyncService
			},
			identity: &authn.Identity{
				AuthenticatedBy: login.SAMLAuthModule,
				AuthID:          "1",
				ExternalUID:     "random-external-uid",
			},
			expectedErr: errUserExternalUIDMismatch.Errorf("the provisioned user.ExternalUID does not match the authinfo.ExternalUID"),
		},
		{
			desc: "it should fail to validate the provisioned user.ExternalUID with the identity.ExternalUID - different ExternalUID",
			userSyncServiceSetup: func() *UserSync {
				userSyncService := initUserSyncService()
				userSyncService.allowNonProvisionedUsers = false
				userSyncService.isUserProvisioningEnabled = true
				userSyncService.userService = &usertest.FakeUserService{
					ExpectedUser: &user.User{
						ID:            1,
						IsProvisioned: true,
					},
				}
				userSyncService.authInfoService = &authinfotest.FakeService{
					ExpectedUserAuth: &login.UserAuth{
						UserId:      1,
						AuthModule:  login.SAMLAuthModule,
						AuthId:      "1",
						ExternalUID: "different-external-uid",
					},
				}
				return userSyncService
			},
			identity: &authn.Identity{
				AuthenticatedBy: login.SAMLAuthModule,
				AuthID:          "1",
				ExternalUID:     "random-external-uid",
			},
			expectedErr: errUserExternalUIDMismatch.Errorf("the provisioned user.ExternalUID does not match the authinfo.ExternalUID"),
		},
		{
			desc: "it should successfully validate the provisioned user.ExternalUID with the identity.ExternalUID",
			userSyncServiceSetup: func() *UserSync {
				userSyncService := initUserSyncService()
				userSyncService.allowNonProvisionedUsers = false
				userSyncService.isUserProvisioningEnabled = true
				userSyncService.userService = &usertest.FakeUserService{
					ExpectedUser: &user.User{
						ID:            1,
						IsProvisioned: true,
					},
				}
				userSyncService.authInfoService = &authinfotest.FakeService{
					ExpectedUserAuth: &login.UserAuth{
						UserId:      1,
						AuthModule:  login.SAMLAuthModule,
						AuthId:      "1",
						ExternalUID: "random-external-uid",
					},
				}
				return userSyncService
			},
			identity: &authn.Identity{
				AuthenticatedBy: login.SAMLAuthModule,
				AuthID:          "1",
				ExternalUID:     "random-external-uid",
			},
		},
		{
			desc: "it should failed to validate a non provisioned user when retrieved from the database",
			userSyncServiceSetup: func() *UserSync {
				userSyncService := initUserSyncService()
				userSyncService.allowNonProvisionedUsers = false
				userSyncService.isUserProvisioningEnabled = true
				userSyncService.userService = &usertest.FakeUserService{
					ExpectedUser: &user.User{
						ID:            1,
						IsProvisioned: false,
					},
				}
				userSyncService.authInfoService = &authinfotest.FakeService{
					ExpectedUserAuth: &login.UserAuth{
						UserId:      1,
						AuthModule:  login.SAMLAuthModule,
						AuthId:      "1",
						ExternalUID: "random-external-uid",
					},
				}
				return userSyncService
			},
			identity: &authn.Identity{
				AuthenticatedBy: login.SAMLAuthModule,
				AuthID:          "1",
				ExternalUID:     "random-external-uid",
			},
			expectedErr: errUserNotProvisioned.Errorf("user is not provisioned"),
		},
		{
			desc: "it should skip validation if identity is incomplete because it's not from the SAML auth flow",
			userSyncServiceSetup: func() *UserSync {
				userSyncService := initUserSyncService()
				userSyncService.allowNonProvisionedUsers = false
				userSyncService.isUserProvisioningEnabled = true
				userSyncService.userService = &usertest.FakeUserService{
					ExpectedUser: &user.User{
						ID:            1,
						IsProvisioned: true,
					},
				}
				userSyncService.authInfoService = &authinfotest.FakeService{
					ExpectedUserAuth: &login.UserAuth{
						UserId:      1,
						AuthModule:  login.SAMLAuthModule,
						AuthId:      "1",
						ExternalUID: "random-external-uid",
					},
				}
				return userSyncService
			},
			identity: &authn.Identity{
				AuthenticatedBy: login.SAMLAuthModule,
				AuthID:          "1",
				ExternalUID:     "",
			},
			expectedErr: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			userSyncService := tt.userSyncServiceSetup()
			err := userSyncService.ValidateUserProvisioningHook(context.Background(), tt.identity, nil)
			require.ErrorIs(t, err, tt.expectedErr)
		})
	}
}
