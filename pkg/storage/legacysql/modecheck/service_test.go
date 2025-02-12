package modecheck_test

import (
	"context"
	"testing"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/legacysql/modecheck"
	"github.com/grafana/grafana/pkg/storage/legacysql/modecheck/store"
)

func TestService(t *testing.T) {
	ctx := context.Background()
	checker := modecheck.ProvideModeChecker(store.ProvideStorage())

	gr := schema.GroupResource{Group: "ggg", Resource: "rrr"}
	status, found := checker.Status(ctx, gr)
	require.False(t, found, "initially not found")
	require.Equal(t, modecheck.StorageStatus{
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

}
