package iam

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseAPIs(t *testing.T) {
	tests := []struct {
		name    string
		values  []string
		want    []API
		wantErr string
	}{
		{
			name:   "parses and deduplicates APIs",
			values: []string{"roles", "teams", "roles"},
			want:   []API{APIRoles, APITeams},
		},
		{
			name:   "none disables every API",
			values: []string{"none"},
		},
		{
			name:    "none cannot be combined",
			values:  []string{"none", "roles"},
			wantErr: "cannot be combined",
		},
		{
			name:    "rejects unknown API",
			values:  []string{"coreroles"},
			wantErr: "unknown iam api",
		},
		{
			name:    "rejects empty configuration",
			wantErr: "at least one iam api",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseAPIs(tt.values)
			if tt.wantErr != "" {
				require.ErrorContains(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.want, got)
		})
	}
}

func TestFeaturesSetAPIsReplacesAPISurface(t *testing.T) {
	features := Features{
		RolesAPI:       true,
		GlobalRolesAPI: true,
		ZanzanaSync:    true,
	}

	features.SetAPIs([]API{APITeams, APIUsers})

	require.Equal(t, []API{APITeams, APIUsers}, features.EnabledAPIs())
	require.True(t, features.ZanzanaSync)
}

func TestFeaturesValidate(t *testing.T) {
	t.Run("service account tokens require service accounts", func(t *testing.T) {
		err := (Features{ServiceAccountTokensAPI: true}).Validate()
		require.ErrorContains(t, err, "requires")
	})

	t.Run("service account resource permissions require resource permissions", func(t *testing.T) {
		err := (Features{ServiceAccountResourcePermissions: true}).Validate()
		require.ErrorContains(t, err, "resource permissions")
	})

	t.Run("accepts valid dependencies", func(t *testing.T) {
		err := (Features{
			ServiceAccountsAPI:                true,
			ServiceAccountTokensAPI:           true,
			ResourcePermissionsAPI:            true,
			ServiceAccountResourcePermissions: true,
		}).Validate()
		require.NoError(t, err)
	})
}
