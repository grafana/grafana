package orguserimpl

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/orguser"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
)

func TestIntegrationOrgUserDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ss := sqlstore.InitTestDB(t)
	orgUserStore := sqlStore{
		db: ss,
	}

	t.Run("org user inserted", func(t *testing.T) {
		_, err := orgUserStore.Insert(context.Background(), &orguser.OrgUser{
			ID:      1,
			OrgID:   1,
			UserID:  1,
			Created: time.Now(),
			Updated: time.Now(),
		})
		require.NoError(t, err)
	})
}
