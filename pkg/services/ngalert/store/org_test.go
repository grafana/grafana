package store

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/ngalert/testutil"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	tutil "github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationFetchOrgIds(t *testing.T) {
	tutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()

	t.Run("returns empty result when no orgs exist", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		store := &DBstore{SQLStore: sqlStore}
		orgIDs, err := store.FetchOrgIds(ctx)
		require.NoError(t, err)
		require.Empty(t, orgIDs)
	})

	t.Run("returns all org IDs", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		store := &DBstore{SQLStore: sqlStore}
		orgService, err := testutil.SetupOrgService(t, sqlStore, setting.NewCfg())
		require.NoError(t, err)

		createdOrgIDs := make([]int64, 3)

		for i := range 3 {
			require.NoError(t, err)
			newOrg, err := orgService.CreateWithMember(ctx, &org.CreateOrgCommand{Name: fmt.Sprintf("org-%d", i)})
			require.NoError(t, err)
			createdOrgIDs[i] = newOrg.ID
		}

		orgIDs, err := store.FetchOrgIds(ctx)

		require.NoError(t, err)
		require.ElementsMatch(t, createdOrgIDs, orgIDs)
	})
}
