package sync

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

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
