package dualwrite

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestService(t *testing.T) {
	ctx := context.Background()
	mode := ProvideService(featuremgmt.WithFeatures(), nil, kvstore.NewFakeKVStore(), nil)

	gr := schema.GroupResource{Group: "ggg", Resource: "rrr"}
	status, err := mode.Status(ctx, gr)
	require.NoError(t, err)
	require.Equal(t, StorageStatus{
		Group:        "ggg",
		Resource:     "rrr",
		WriteLegacy:  true,
		WriteUnified: true,
		ReadUnified:  false,
		Migrated:     0,
		Migrating:    0,
		Runtime:      true,
		UpdateKey:    1,
	}, status, "should start with the right defaults")

	// Start migration
	status, err = mode.StartMigration(ctx, gr, 1)
	require.NoError(t, err)
	require.Equal(t, status.UpdateKey, int64(2), "the key increased")
	require.True(t, status.Migrating > 0, "migration is running")

	status.Migrated = time.Now().UnixMilli()
	status.Migrating = 0
	status, err = mode.Update(ctx, status)
	require.NoError(t, err)
	require.Equal(t, status.UpdateKey, int64(3), "the key increased")
	require.Equal(t, status.Migrating, int64(0), "done migrating")
	require.True(t, status.Migrated > 0, "migration is running")

	status.WriteUnified = false
	status.ReadUnified = true
	_, err = mode.Update(ctx, status)
	require.Error(t, err) // must write unified if we read it

	status.WriteUnified = false
	status.ReadUnified = false
	status.WriteLegacy = false
	_, err = mode.Update(ctx, status)
	require.Error(t, err) // must write something!
}
