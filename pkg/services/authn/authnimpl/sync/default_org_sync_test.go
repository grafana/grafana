package sync

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestDefaultOrgHook_SetDefaultOrg(t *testing.T) {
	testCases := []struct {
		name              string
		defaultOrgSetting int64
		identity          *authn.Identity
		setupMock         func(*usertest.MockService)

		wantErr bool
	}{
		{
			name:              "should set default org",
			defaultOrgSetting: 2,
			identity:          &authn.Identity{ID: "user:1"},
			setupMock: func(userService *usertest.MockService) {
				userService.On("SetUsingOrg", mock.Anything, mock.MatchedBy(func(cmd *user.SetUsingOrgCommand) bool {
					return cmd.UserID == 1 && cmd.OrgID == 2
				})).Return(nil)
			},
		},
		{
			name:              "should not set default org when default org is not set",
			defaultOrgSetting: -1,
			identity:          &authn.Identity{ID: "user:1"},
		},
		{
			name:              "should not set default org when identity is nil",
			defaultOrgSetting: -1,
			identity:          nil,
		},
		{
			name:              "should not set default org when identity is not a user",
			defaultOrgSetting: 2,
			identity:          &authn.Identity{ID: "service-account:1"},
		},
		{
			name:              "should not set default org when user id is not valid",
			defaultOrgSetting: 2,
			identity:          &authn.Identity{ID: "user:invalid"},
		},
		{
			name:              "should not set default org when user is not allowed to use the configured default org",
			defaultOrgSetting: 3,
			identity:          &authn.Identity{ID: "user:1"},
		},
		{
			name:              "should return error when the user org update was unsuccessful",
			defaultOrgSetting: 2,
			identity:          &authn.Identity{ID: "user:1"},
			setupMock: func(userService *usertest.MockService) {
				userService.On("SetUsingOrg", mock.Anything, mock.Anything).Return(fmt.Errorf("error"))
			},
			wantErr: true,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.LoginDefaultOrgId = tc.defaultOrgSetting

			userService := &usertest.MockService{}
			defer userService.AssertExpectations(t)

			if tc.setupMock != nil {
				tc.setupMock(userService)
			}

			orgService := &orgtest.FakeOrgService{
				ExpectedUserOrgDTO: []*org.UserOrgDTO{{OrgID: 2}},
			}

			hook := ProvideDefaultOrgSync(cfg, userService, orgService)

			err := hook.SetDefaultOrg(context.Background(), tc.identity, nil)
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}
