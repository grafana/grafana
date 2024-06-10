package sqlstore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

// testing a regression which shows up when the main org is created, but not the
// admin user: getOrCreateOrg was unable to find the existing org.
// https://github.com/grafana/grafana/issues/71781
func TestIntegrationGetOrCreateOrg(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}
	ss := InitTestDB(t)

	err := ss.WithNewDbSession(context.Background(), func(sess *DBSession) error {
		// Create the org only:
		ss.Cfg.AutoAssignOrg = true
		ss.Cfg.DisableInitAdminCreation = true
		ss.Cfg.AutoAssignOrgId = 1
		createdOrgID, err := ss.getOrCreateOrg(sess, mainOrgName)
		require.NoError(t, err)
		require.Equal(t, int64(1), createdOrgID)
		return nil
	})
	require.NoError(t, err)

	err = ss.WithNewDbSession(context.Background(), func(sess *DBSession) error {
		// Run it a second time and verify that it finds the org that was
		// created above.
		gotOrgId, err := ss.getOrCreateOrg(sess, mainOrgName)
		require.NoError(t, err)
		require.Equal(t, int64(1), gotOrgId)
		return nil
	})
	require.NoError(t, err)
}
