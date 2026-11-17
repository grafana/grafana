package datasource

import (
	"testing"

	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// Provisioning runs as an access policy, so GetID() is "access-policy:<n>" and there is no numeric
// user id to record. Parsing it as one failed every provisioned write with
// `strconv.ParseInt: parsing "access-policy:0": invalid syntax`.
func TestLegacyUserID(t *testing.T) {
	tests := []struct {
		name string
		typ  claims.IdentityType
		id   int64
		want int64
	}{
		{name: "an access policy records no user", typ: claims.TypeAccessPolicy, want: 0},
		{name: "a user records its id", typ: claims.TypeUser, id: 42, want: 42},
		{name: "a service account records its id", typ: claims.TypeServiceAccount, id: 7, want: 7},
		// An uninitialized user id is not an error either: the row simply records none.
		{name: "an uninitialized user records no user", typ: claims.TypeUser, id: 0, want: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := legacyUserID(&identity.StaticRequester{Type: tt.typ, UserID: tt.id})
			require.NoError(t, err)
			require.Equal(t, tt.want, got)
		})
	}
}
