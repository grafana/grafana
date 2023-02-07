package login

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

func TestIsExternallySynced(t *testing.T) {
	testcases := []struct {
		name     string
		cfg      *setting.Cfg
		provider string
		expected bool
	}{
		{
			name:     "Google synced user should return that it is externally synced",
			cfg:      &setting.Cfg{GoogleSkipOrgRoleSync: false},
			provider: "Google",
			expected: true,
		},
		{
			name:     "Google synced user should return that it is not externally synced when org role sync is set",
			cfg:      &setting.Cfg{GoogleSkipOrgRoleSync: true},
			provider: "Google",
			expected: false,
		},
		// deprecated setting for skipping org role sync for all external oauth providers
		{
			name:     "external user should return that it is not externally synced when oauth org role sync is set",
			cfg:      &setting.Cfg{GoogleSkipOrgRoleSync: false, OAuthSkipOrgRoleUpdateSync: true},
			provider: "Google",
			expected: false,
		},
	}

	for _, tc := range testcases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, IsExternallySynced(tc.cfg, tc.provider))
		})
	}
}
