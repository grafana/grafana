package annotations

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/annotations/pkg/apis/annotations/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/annotations"
)

func TestItemQueryConversion(t *testing.T) {
	userOrg25 := &identity.StaticRequester{OrgID: 25}
	tests := []struct {
		name   string
		user   identity.Requester
		query  *v0alpha1.ItemQuery
		expect *annotations.ItemQuery
		err    string
	}{
		{
			name:  "missing user",
			query: &v0alpha1.ItemQuery{},
			err:   "a Requester was not found in the context",
		},
		{
			name: "simple",
			user: userOrg25,
			query: &v0alpha1.ItemQuery{
				From:         1234,
				To:           5678,
				DashboardUID: "aaa",
			},
			expect: &annotations.ItemQuery{
				OrgID:        25,
				From:         1234,
				To:           5678,
				DashboardUID: "aaa",
				SignedInUser: userOrg25,
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			if tt.user != nil {
				ctx = identity.WithRequester(ctx, tt.user)
			}
			query, err := toLegacyItemQuery(ctx, tt.query)
			if tt.err != "" {
				require.Error(t, err)
				require.ErrorContains(t, err, tt.err)
				require.Nil(t, query)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.expect, query)
		})
	}
}
