package usersync

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/logintest"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/stretchr/testify/require"
)

func ptrString(s string) *string {
	return &s
}

func ptrBool(b bool) *bool {
	return &b
}

func ptrInt64(i int64) *int64 {
	return &i
}

func TestUserSync_SyncUser(t *testing.T) {
	authFakeNil := &logintest.AuthInfoServiceFake{
		ExpectedUser:  nil,
		ExpectedError: user.ErrUserNotFound,
		SetAuthInfoFn: func(ctx context.Context, cmd *models.SetAuthInfoCommand) error {
			return nil
		},
		UpdateAuthInfoFn: func(ctx context.Context, cmd *models.UpdateAuthInfoCommand) error {
			return nil
		},
	}
	authFakeUserID := &logintest.AuthInfoServiceFake{
		ExpectedUser:  nil,
		ExpectedError: nil,
		ExpectedUserAuth: &models.UserAuth{
			AuthModule: "oauth",
			AuthId:     "2032",
			UserId:     1,
			Id:         1}}

	userService := &usertest.FakeUserService{ExpectedUser: &user.User{
		ID:    1,
		Login: "test",
		Name:  "test",
		Email: "test",
	}}

	userServiceMod := &usertest.FakeUserService{ExpectedUser: &user.User{
		ID:         3,
		Login:      "test",
		Name:       "test",
		Email:      "test",
		IsDisabled: true,
		IsAdmin:    false,
	}}

	userServiceNil := &usertest.FakeUserService{
		ExpectedUser:  nil,
		ExpectedError: user.ErrUserNotFound,
		CreateFn: func(ctx context.Context, cmd *user.CreateUserCommand) (*user.User, error) {
			return &user.User{
				ID:      2,
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
		log             log.Logger
	}
	type args struct {
		ctx          context.Context
		clientParams *authn.ClientParams
		id           *authn.Identity
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
				log:             log.NewNopLogger(),
			},
			args: args{
				ctx: context.Background(),
				clientParams: &authn.ClientParams{
					SyncUser:            false,
					AllowSignUp:         false,
					EnableDisabledUsers: false,
				},
				id: &authn.Identity{
					ID:    "",
					Login: "test",
					Name:  "test",
					Email: "test",
					LookUpParams: models.UserLookupParams{
						UserID: nil,
						Email:  ptrString("test"),
						Login:  nil,
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:    "",
				Login: "test",
				Name:  "test",
				Email: "test",
				LookUpParams: models.UserLookupParams{
					UserID: nil,
					Email:  ptrString("test"),
					Login:  nil,
				},
			},
		},
		{
			name: "sync - user found in DB - by email",
			fields: fields{
				userService:     userService,
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
				log:             log.NewNopLogger(),
			},
			args: args{
				ctx: context.Background(),
				clientParams: &authn.ClientParams{
					SyncUser:            true,
					AllowSignUp:         false,
					EnableDisabledUsers: false,
				},
				id: &authn.Identity{
					ID:    "",
					Login: "test",
					Name:  "test",
					Email: "test",
					LookUpParams: models.UserLookupParams{
						UserID: nil,
						Email:  ptrString("test"),
						Login:  nil,
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:             "user:1",
				Login:          "test",
				Name:           "test",
				Email:          "test",
				IsGrafanaAdmin: ptrBool(false),
				LookUpParams: models.UserLookupParams{
					UserID: nil,
					Email:  ptrString("test"),
					Login:  nil,
				},
			},
		},
		{
			name: "sync - user found in DB - by login",
			fields: fields{
				userService:     userService,
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
				log:             log.NewNopLogger(),
			},
			args: args{
				ctx: context.Background(),
				clientParams: &authn.ClientParams{
					SyncUser:            true,
					AllowSignUp:         false,
					EnableDisabledUsers: false,
				},
				id: &authn.Identity{
					ID:    "",
					Login: "test",
					Name:  "test",
					Email: "test",
					LookUpParams: models.UserLookupParams{
						UserID: nil,
						Email:  nil,
						Login:  ptrString("test"),
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:             "user:1",
				Login:          "test",
				Name:           "test",
				Email:          "test",
				IsGrafanaAdmin: ptrBool(false),
				LookUpParams: models.UserLookupParams{
					UserID: nil,
					Email:  nil,
					Login:  ptrString("test"),
				},
			},
		},
		{
			name: "sync - user found in DB - by ID",
			fields: fields{
				userService:     userService,
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
				log:             log.NewNopLogger(),
			},
			args: args{
				ctx: context.Background(),
				clientParams: &authn.ClientParams{
					SyncUser:            true,
					AllowSignUp:         false,
					EnableDisabledUsers: false,
				},
				id: &authn.Identity{
					ID:    "",
					Login: "test",
					Name:  "test",
					Email: "test",
					LookUpParams: models.UserLookupParams{
						UserID: ptrInt64(1),
						Email:  nil,
						Login:  nil,
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:             "user:1",
				Login:          "test",
				Name:           "test",
				Email:          "test",
				IsGrafanaAdmin: ptrBool(false),
				LookUpParams: models.UserLookupParams{
					UserID: ptrInt64(1),
					Email:  nil,
					Login:  nil,
				},
			},
		},
		{
			name: "sync - user found in authInfo",
			fields: fields{
				userService:     userService,
				authInfoService: authFakeUserID,
				quotaService:    &quotatest.FakeQuotaService{},
				log:             log.NewNopLogger(),
			},
			args: args{
				ctx: context.Background(),
				clientParams: &authn.ClientParams{
					SyncUser:            true,
					AllowSignUp:         false,
					EnableDisabledUsers: false,
				},
				id: &authn.Identity{
					ID:    "",
					Login: "test",
					Name:  "test",
					Email: "test",
					LookUpParams: models.UserLookupParams{
						UserID: nil,
						Email:  nil,
						Login:  nil,
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:             "user:1",
				Login:          "test",
				Name:           "test",
				Email:          "test",
				IsGrafanaAdmin: ptrBool(false),
				LookUpParams: models.UserLookupParams{
					UserID: nil,
					Email:  nil,
					Login:  nil,
				},
			},
		},
		{
			name: "sync - user needs to be created - disabled signup",
			fields: fields{
				userService:     userService,
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
				log:             log.NewNopLogger(),
			},
			args: args{
				ctx: context.Background(),
				clientParams: &authn.ClientParams{
					SyncUser:            true,
					AllowSignUp:         false,
					EnableDisabledUsers: false,
				},
				id: &authn.Identity{
					ID:         "",
					Login:      "test",
					Name:       "test",
					Email:      "test",
					AuthModule: "oauth",
					AuthID:     "2032",
					LookUpParams: models.UserLookupParams{
						UserID: nil,
						Email:  nil,
						Login:  nil,
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
				log:             log.NewNopLogger(),
			},
			args: args{
				ctx: context.Background(),
				clientParams: &authn.ClientParams{
					SyncUser:            true,
					AllowSignUp:         true,
					EnableDisabledUsers: true,
				},
				id: &authn.Identity{
					ID:             "",
					Login:          "test_create",
					Name:           "test_create",
					IsGrafanaAdmin: ptrBool(true),
					Email:          "test_create",
					AuthModule:     "oauth",
					AuthID:         "2032",
					LookUpParams: models.UserLookupParams{
						UserID: nil,
						Email:  ptrString("test_create"),
						Login:  nil,
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:             "user:2",
				Login:          "test_create",
				Name:           "test_create",
				Email:          "test_create",
				AuthModule:     "oauth",
				AuthID:         "2032",
				IsGrafanaAdmin: ptrBool(true),
				LookUpParams: models.UserLookupParams{
					UserID: nil,
					Email:  ptrString("test_create"),
					Login:  nil,
				},
			},
		},
		{
			name: "sync - needs full update",
			fields: fields{
				userService:     userServiceMod,
				authInfoService: authFakeNil,
				quotaService:    &quotatest.FakeQuotaService{},
				log:             log.NewNopLogger(),
			},
			args: args{
				ctx: context.Background(),
				clientParams: &authn.ClientParams{
					SyncUser:            true,
					AllowSignUp:         false,
					EnableDisabledUsers: true,
				},
				id: &authn.Identity{
					ID:             "",
					Login:          "test_mod",
					Name:           "test_mod",
					Email:          "test_mod",
					IsDisabled:     false,
					IsGrafanaAdmin: ptrBool(true),
					LookUpParams: models.UserLookupParams{
						UserID: ptrInt64(3),
						Email:  nil,
						Login:  nil,
					},
				},
			},
			wantErr: false,
			wantID: &authn.Identity{
				ID:             "user:3",
				Login:          "test_mod",
				Name:           "test_mod",
				Email:          "test_mod",
				IsDisabled:     false,
				IsGrafanaAdmin: ptrBool(true),
				LookUpParams: models.UserLookupParams{
					UserID: ptrInt64(3),
					Email:  nil,
					Login:  nil,
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &UserSync{
				userService:     tt.fields.userService,
				authInfoService: tt.fields.authInfoService,
				quotaService:    tt.fields.quotaService,
				log:             tt.fields.log,
			}
			err := s.SyncUser(tt.args.ctx, tt.args.clientParams, tt.args.id)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			require.EqualValues(t, tt.wantID, tt.args.id)
		})
	}
}
