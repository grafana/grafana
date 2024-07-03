package validation

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/user"
)

type testCase struct {
	name      string
	input     *social.OAuthInfo
	requester identity.Requester
	wantErr   error
}

func TestUrlValidator(t *testing.T) {
	tc := []testCase{
		{
			name: "passes when url is valid",
			input: &social.OAuthInfo{
				AuthUrl: "https://example.com/auth",
			},
			wantErr: nil,
		},
		{
			name: "fails when url is invalid",
			input: &social.OAuthInfo{
				AuthUrl: "file://etc",
			},
			wantErr: ssosettings.ErrInvalidOAuthConfig("Auth URL is an invalid URL."),
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			err := UrlValidator(tt.input.AuthUrl, "Auth URL")(tt.input, tt.requester)
			if tt.wantErr != nil {
				require.ErrorIs(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestRequiredValidator(t *testing.T) {
	tc := []testCase{
		{
			name: "passes when client id is not empty",
			input: &social.OAuthInfo{
				ClientId: "client-id",
			},
			wantErr: nil,
		},
		{
			name: "fails when client id is empty",
			input: &social.OAuthInfo{
				ClientId: "",
			},
			wantErr: ssosettings.ErrInvalidOAuthConfig("Client Id is required."),
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			err := RequiredValidator(tt.input.ClientId, "Client Id")(tt.input, tt.requester)
			if tt.wantErr != nil {
				require.ErrorIs(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestAllowAssignGrafanaAdminValidator(t *testing.T) {
	tc := []testCase{
		{
			name: "passes when user is grafana admin and allow assign grafana admin is true",
			input: &social.OAuthInfo{
				AllowAssignGrafanaAdmin: true,
			},
			requester: &user.SignedInUser{
				IsGrafanaAdmin: true,
			},
			wantErr: nil,
		},
		{
			name: "fails when user is not grafana admin and allow assign grafana admin is true",
			input: &social.OAuthInfo{
				AllowAssignGrafanaAdmin: true,
			},
			requester: &user.SignedInUser{
				IsGrafanaAdmin: false,
			},
			wantErr: ssosettings.ErrInvalidOAuthConfig("Allow assign Grafana Admin can only be updated by Grafana Server Admins."),
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			err := AllowAssignGrafanaAdminValidator(tt.input, tt.requester)
			if tt.wantErr != nil {
				require.ErrorIs(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestSkipOrgRoleSyncAllowAssignGrafanaAdminValidator(t *testing.T) {
	tc := []testCase{
		{
			name: "passes when allow assign grafana admin is set, but skip org role sync is not set",
			input: &social.OAuthInfo{
				AllowAssignGrafanaAdmin: true,
				SkipOrgRoleSync:         false,
			},
			wantErr: nil,
		},
		{
			name: "passes when allow assign grafana admin is not set, but skip org role sync is set",
			input: &social.OAuthInfo{
				AllowAssignGrafanaAdmin: false,
				SkipOrgRoleSync:         true,
			},
			wantErr: nil,
		},
		{
			name: "fails when both allow assign grafana admin and skip org role sync is set",
			input: &social.OAuthInfo{
				AllowAssignGrafanaAdmin: true,
				SkipOrgRoleSync:         true,
			},
			wantErr: ssosettings.ErrInvalidOAuthConfig("Allow assign Grafana Admin and Skip org role sync are both set thus Grafana Admin role will not be synced. Consider setting one or the other."),
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			err := SkipOrgRoleSyncAllowAssignGrafanaAdminValidator(tt.input, nil)
			if tt.wantErr != nil {
				require.ErrorIs(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestOrgMappingValidator(t *testing.T) {
	tc := []testCase{
		{
			name: "passes when user is grafana admin and org mapping is set",
			input: &social.OAuthInfo{
				OrgMapping: []string{"group1:1:Viewer"},
			},
			requester: &user.SignedInUser{
				IsGrafanaAdmin: true,
			},
			wantErr: nil,
		},
		{
			name: "fails when user is not grafana admin and org mapping is set",
			input: &social.OAuthInfo{
				OrgMapping: []string{"group1:1:Viewer"},
			},
			requester: &user.SignedInUser{
				IsGrafanaAdmin: false,
			},
			wantErr: ssosettings.ErrInvalidOAuthConfig("Organization mapping can only be updated by Grafana Server Admins."),
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			err := OrgMappingValidator(tt.input, tt.requester)
			if tt.wantErr != nil {
				require.ErrorIs(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestOrgAttributePathValidator(t *testing.T) {
	tc := []testCase{
		{
			name: "passes when user is grafana admin and org attribute path is set",
			input: &social.OAuthInfo{
				OrgAttributePath: "path",
			},
			requester: &user.SignedInUser{
				IsGrafanaAdmin: true,
			},
			wantErr: nil,
		},
		{
			name: "fails when user is not grafana admin and org attribute path is set",
			input: &social.OAuthInfo{
				OrgAttributePath: "path",
			},
			requester: &user.SignedInUser{
				IsGrafanaAdmin: false,
			},
			wantErr: ssosettings.ErrInvalidOAuthConfig("Organization attribute path can only be updated by Grafana Server Admins."),
		},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			err := OrgAttributePathValidator(tt.input, tt.requester)
			if tt.wantErr != nil {
				require.ErrorIs(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
		})
	}
}
