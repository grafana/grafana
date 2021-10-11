package accesscontrol

import (
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var testUser = &models.SignedInUser{
	UserId:  2,
	OrgId:   3,
	OrgName: "TestOrg",
	OrgRole: models.ROLE_VIEWER,
	Login:   "testUser",
	Name:    "Test User",
	Email:   "testuser@example.org",
}

func Test_resolveKeywordedScopes(t *testing.T) {
	tests := []struct {
		name    string
		u       *models.SignedInUser
		scopes  map[string]struct{}
		want    map[string]struct{}
		wantErr bool
	}{
		{
			name:    "empty test",
			u:       testUser,
			scopes:  nil,
			want:    nil,
			wantErr: false,
		},
		{
			name:    "no translation test",
			u:       testUser,
			scopes:  map[string]struct{}{"users:1": {}},
			want:    map[string]struct{}{"users:1": {}},
			wantErr: false,
		},
		{
			name:    "multiple translation test",
			u:       testUser,
			scopes:  map[string]struct{}{"users:self": {}, "orgs:current": {}},
			want:    map[string]struct{}{"users:2": {}, "orgs:3": {}},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resolved, err := resolveKeywordedScopes(tt.u, tt.scopes)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			assert.EqualValues(t, resolved, tt.want)
		})
	}
}

func TestResolvePermissionsKeywordedScopes(t *testing.T) {
	tests := []struct {
		name        string
		u           *models.SignedInUser
		permissions map[string]map[string]struct{}
		want        map[string]map[string]struct{}
		wantErr     bool
	}{
		{
			name:        "empty test",
			u:           testUser,
			permissions: nil,
			want:        nil,
			wantErr:     false,
		},
		{
			name: "no translation test",
			u:    testUser,
			permissions: map[string]map[string]struct{}{
				"users:read": {"users:1": {}},
				"orgs:read":  {"orgs:1": {}},
			},
			want: map[string]map[string]struct{}{
				"users:read": {"users:1": {}},
				"orgs:read":  {"orgs:1": {}},
			},
			wantErr: false,
		},
		{
			name: "multiple translation test",
			u:    testUser,
			permissions: map[string]map[string]struct{}{
				"users:read": {"users:self": {}},
				"orgs:read":  {"orgs:current": {}},
				"orgs:write": {"orgs:current": {}},
			},
			want: map[string]map[string]struct{}{
				"users:read": {"users:2": {}},
				"orgs:read":  {"orgs:3": {}},
				"orgs:write": {"orgs:3": {}},
			},
			wantErr: false,
		},
		{
			name: "slightly more complex translation test",
			u:    testUser,
			permissions: map[string]map[string]struct{}{
				"users:read": {"users:self": {}},
				"orgs:read":  {"orgs:1": {}, "orgs:5": {}, "orgs:current": {}},
				"orgs:write": {"orgs:1": {}, "orgs:5": {}, "orgs:current": {}},
			},
			want: map[string]map[string]struct{}{
				"users:read": {"users:2": {}},
				"orgs:read":  {"orgs:1": {}, "orgs:5": {}, "orgs:3": {}},
				"orgs:write": {"orgs:1": {}, "orgs:5": {}, "orgs:3": {}},
			},
			wantErr: false,
		},
		{
			name: "conflicting translations test",
			u:    testUser,
			permissions: map[string]map[string]struct{}{
				"users:read": {"users:2": {}, "users:self": {}},
			},
			want: map[string]map[string]struct{}{
				"users:read": {"users:2": {}},
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resolved, err := ResolvePermissionsKeywordedScopes(tt.u, tt.permissions)
			if tt.wantErr {
				require.Error(t, err, "expected an error during the grouped permissions resolution")
				return
			}
			require.NoError(t, err, "did not expect an error during the grouped permissions resolution")

			assert.EqualValues(t, resolved, tt.want, "resolution of grouped permissions did not end with expected result")
		})
	}
}
