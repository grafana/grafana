package hook

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
)

func TestDefaultOrgHook_SetDefaultOrg(t *testing.T) {
	testCases := []struct {
		name              string
		defaultOrgSetting int64
		inputErr          error
		identity          *authn.Identity

		expectSetUsingOrgCalled bool
	}{
		{
			name:                    "should set default org",
			defaultOrgSetting:       2,
			identity:                &authn.Identity{ID: "user:1"},
			expectSetUsingOrgCalled: true,
		},
		{
			name:                    "should not set default org when default org is not set",
			defaultOrgSetting:       -1,
			identity:                &authn.Identity{ID: "user:1"},
			expectSetUsingOrgCalled: false,
		},
		{
			name:                    "should not set default org when identity is nil",
			defaultOrgSetting:       -1,
			identity:                nil,
			expectSetUsingOrgCalled: false,
		},
		{
			name:                    "should not set default org when error is not nil",
			defaultOrgSetting:       1,
			identity:                &authn.Identity{ID: "user:1"},
			inputErr:                fmt.Errorf("error"),
			expectSetUsingOrgCalled: false,
		},
		{
			name:                    "should not set default org when identity is not a user",
			defaultOrgSetting:       2,
			identity:                &authn.Identity{ID: "service-account:1"},
			expectSetUsingOrgCalled: false,
		},
		{
			name:                    "should not set default org when error is not nil",
			defaultOrgSetting:       2,
			identity:                &authn.Identity{ID: "user:1"},
			expectSetUsingOrgCalled: false,
		},
		{
			name:                    "should not set default org when user id is not valid",
			defaultOrgSetting:       2,
			identity:                &authn.Identity{ID: "user:invalid"},
			expectSetUsingOrgCalled: false,
		},
		{
			name:                    "should not set default org when user is not allowed to use the configured default org",
			defaultOrgSetting:       3,
			identity:                &authn.Identity{ID: "user:1"},
			expectSetUsingOrgCalled: false,
		},
	}
	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.LoginDefaultOrgId = tt.defaultOrgSetting

			userService := &usertest.MockService{}
			userService.On("SetUsingOrg", mock.Anything, mock.MatchedBy(func(cmd *user.SetUsingOrgCommand) bool {
				return cmd.UserID == 1 && cmd.OrgID == 2
			})).Return(nil)

			orgService := &orgtest.FakeOrgService{
				ExpectedUserOrgDTO: []*org.UserOrgDTO{{OrgID: 2}},
			}

			hook := ProvideDefaultOrgHook(cfg, userService, orgService)

			hook.SetDefaultOrg(context.Background(), tt.identity, nil, tt.inputErr)

			if tt.expectSetUsingOrgCalled {
				userService.AssertExpectations(t)
			} else {
				userService.AssertNotCalled(t, "SetUsingOrg")
			}
		})
	}
}
