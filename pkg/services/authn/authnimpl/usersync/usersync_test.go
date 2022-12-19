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

func TestUserSync_SyncUser(t *testing.T) {
	authFakeNil := &logintest.AuthInfoServiceFake{ExpectedUser: nil, ExpectedError: user.ErrUserNotFound}
	userService := &usertest.FakeUserService{ExpectedUser: &user.User{
		ID:    1,
		Login: "test",
		Name:  "test",
		Email: "test",
	}}

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
			name: "sync - user found in DB",
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
