package accesscontrol

import (
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
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

func TestResolveKeywordedScope(t *testing.T) {
	tests := []struct {
		name       string
		user       *models.SignedInUser
		permission Permission
		want       *Permission
		wantErr    bool
	}{
		{
			name:       "no scope",
			user:       testUser,
			permission: Permission{Action: "users:read"},
			want:       &Permission{Action: "users:read"},
			wantErr:    false,
		},
		{
			name:       "user if resolution",
			user:       testUser,
			permission: Permission{Action: "users:read", Scope: "users:self"},
			want:       &Permission{Action: "users:read", Scope: "users:id:2"},
			wantErr:    false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resolved, err := ResolveKeywordScope(tt.user, tt.permission)
			if tt.wantErr {
				assert.Error(t, err, "expected an error during the resolution of the scope")
				return
			}
			assert.NoError(t, err)
			assert.EqualValues(t, tt.want, resolved, "permission did not match expected resolution")
		})
	}
}
