package sync

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
)

func TestOrgSync_SyncOrgRolesHook(t *testing.T) {
	orgService := &orgtest.FakeOrgService{ExpectedUserOrgDTO: []*org.UserOrgDTO{
		{
			OrgID: 1,
			Role:  org.RoleEditor,
		},
		{
			OrgID: 3,
			Role:  org.RoleViewer,
		},
	},
		ExpectedOrgListResponse: orgtest.OrgListResponse{
			{
				OrgID:    3,
				Response: nil,
			},
		},
	}
	acService := &actest.FakeService{}
	userService := &usertest.FakeUserService{ExpectedUser: &user.User{
		ID:    1,
		Login: "test",
		Name:  "test",
		Email: "test",
	}}

	type fields struct {
		userService   user.Service
		orgService    org.Service
		accessControl accesscontrol.Service
		log           log.Logger
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
			name: "add user to multiple orgs",
			fields: fields{
				userService:   userService,
				orgService:    orgService,
				accessControl: acService,
				log:           log.NewNopLogger(),
			},
			args: args{
				ctx: context.Background(),
				id: &authn.Identity{
					ID:             "user:1",
					Login:          "test",
					Name:           "test",
					Email:          "test",
					OrgRoles:       map[int64]roletype.RoleType{1: org.RoleAdmin, 2: org.RoleEditor},
					IsGrafanaAdmin: ptrBool(false),
					ClientParams: authn.ClientParams{
						SyncOrgRoles: true,
						LookUpParams: login.UserLookupParams{
							UserID: nil,
							Email:  ptrString("test"),
							Login:  nil,
						},
					},
				},
			},
			wantID: &authn.Identity{
				ID:             "user:1",
				Login:          "test",
				Name:           "test",
				Email:          "test",
				OrgRoles:       map[int64]roletype.RoleType{1: org.RoleAdmin, 2: org.RoleEditor},
				OrgID:          1, //set using org
				IsGrafanaAdmin: ptrBool(false),
				ClientParams: authn.ClientParams{
					SyncOrgRoles: true,
					LookUpParams: login.UserLookupParams{
						UserID: nil,
						Email:  ptrString("test"),
						Login:  nil,
					},
				},
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &OrgSync{
				userService:   tt.fields.userService,
				orgService:    tt.fields.orgService,
				accessControl: tt.fields.accessControl,
				log:           tt.fields.log,
			}
			if err := s.SyncOrgRolesHook(tt.args.ctx, tt.args.id, nil); (err != nil) != tt.wantErr {
				t.Errorf("OrgSync.SyncOrgRolesHook() error = %v, wantErr %v", err, tt.wantErr)
			}

			assert.EqualValues(t, tt.wantID, tt.args.id)
		})
	}
}

func TestOrgSync_SetDefaultOrgHook(t *testing.T) {
	testCases := []struct {
		name              string
		defaultOrgSetting int64
		identity          *authn.Identity
		setupMock         func(*usertest.MockService, *orgtest.FakeOrgService)

		wantErr bool
	}{
		{
			name:              "should set default org",
			defaultOrgSetting: 2,
			identity:          &authn.Identity{ID: "user:1"},
			setupMock: func(userService *usertest.MockService, orgService *orgtest.FakeOrgService) {
				userService.On("SetUsingOrg", mock.Anything, mock.MatchedBy(func(cmd *user.SetUsingOrgCommand) bool {
					return cmd.UserID == 1 && cmd.OrgID == 2
				})).Return(nil)
			},
		},
		{
			name:              "should skip setting the default org when default org is not set",
			defaultOrgSetting: -1,
			identity:          &authn.Identity{ID: "user:1"},
		},
		{
			name:              "should skip setting the default org when identity is nil",
			defaultOrgSetting: -1,
			identity:          nil,
		},
		{
			name:              "should skip setting the default org when identity is not a user",
			defaultOrgSetting: 2,
			identity:          &authn.Identity{ID: "service-account:1"},
		},
		{
			name:              "should skip setting the default org when user id is not valid",
			defaultOrgSetting: 2,
			identity:          &authn.Identity{ID: "user:invalid"},
		},
		{
			name:              "should skip setting the default org when user is not allowed to use the configured default org",
			defaultOrgSetting: 3,
			identity:          &authn.Identity{ID: "user:1"},
		},
		{
			name:              "should skip setting the default org when validateUsingOrg returns error",
			defaultOrgSetting: 2,
			identity:          &authn.Identity{ID: "user:1"},
			setupMock: func(userService *usertest.MockService, orgService *orgtest.FakeOrgService) {
				orgService.ExpectedError = fmt.Errorf("error")
			},
		},
		{
			name:              "should return error when the user org update was unsuccessful",
			defaultOrgSetting: 2,
			identity:          &authn.Identity{ID: "user:1"},
			setupMock: func(userService *usertest.MockService, orgService *orgtest.FakeOrgService) {
				userService.On("SetUsingOrg", mock.Anything, mock.Anything).Return(fmt.Errorf("error"))
			},
			wantErr: true,
		},
	}
	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.LoginDefaultOrgId = tt.defaultOrgSetting

			userService := &usertest.MockService{}
			defer userService.AssertExpectations(t)

			orgService := &orgtest.FakeOrgService{
				ExpectedUserOrgDTO: []*org.UserOrgDTO{{OrgID: 2}},
			}

			if tt.setupMock != nil {
				tt.setupMock(userService, orgService)
			}

			s := &OrgSync{
				userService:   userService,
				orgService:    orgService,
				accessControl: actest.FakeService{},
				log:           log.NewNopLogger(),
				cfg:           cfg,
			}

			if err := s.SetDefaultOrgHook(context.Background(), tt.identity, nil); (err != nil) != tt.wantErr {
				t.Errorf("OrgSync.SetDefaultOrgHook() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
