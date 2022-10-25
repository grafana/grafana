package router

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/infra/grn"
	"github.com/grafana/grafana/pkg/services/store/kind"
	"github.com/stretchr/testify/require"
)

func TestSimpleRouter(t *testing.T) {
	ctx := context.Background()
	router := &standardStoreRouter{
		kinds: kind.NewKindRegistry(),
	}
	info, err := router.Route(ctx, grn.GRN{
		ResourceIdentifier: "path/to/file",
	})
	require.Error(t, err) // needs OrgID

	type routeScenario struct {
		GRN   grn.GRN
		Error string
		Key   string
	}

	scenarios := []routeScenario{{
		Error: "missing OrgID",
		GRN:   grn.GRN{Namespace: "drive"},
	}, {
		Error: "unknown kind",
		GRN: grn.GRN{
			TenantID:           11,
			Namespace:          "drive",
			ResourceIdentifier: "path/to/file",
			ResourceKind:       "xyz",
		},
	}, {
		Key: "11/drive/path/to/file-dashboard.json",
		GRN: grn.GRN{
			TenantID:           11,
			Namespace:          "drive",
			ResourceIdentifier: "path/to/file",
			ResourceKind:       "dashboard",
		},
	}, {
		Key: "11/drive/path/to/folder/__folder.json",
		GRN: grn.GRN{
			TenantID:           11,
			Namespace:          "drive",
			ResourceIdentifier: "path/to/folder",
			ResourceKind:       "folder",
		},
	}, {
		Key: "11/drive/path/to/folder/__access.json",
		GRN: grn.GRN{
			TenantID:           11,
			Namespace:          "drive",
			ResourceIdentifier: "path/to/folder",
			ResourceKind:       "folder-access",
		},
	}, {
		Key: "10/drive/path/to/file.png",
		GRN: grn.GRN{
			TenantID:           10,
			Namespace:          "drive",
			ResourceIdentifier: "path/to/file",
			ResourceKind:       "png",
		},
	}, {
		Key: "10/custom/kind/playlist/aaaaa", // ?.json better or not?
		GRN: grn.GRN{
			TenantID:           10,
			Namespace:          "custom", // can this have slashes?
			ResourceIdentifier: "aaaaa",
			ResourceKind:       "playlist",
		},
	}}

	for idx, check := range scenarios {
		testID := fmt.Sprintf("[%d] %s", idx, check.Key)

		// Read the key from the GRN
		info, err = router.Route(ctx, check.GRN)
		if check.Error == "" {
			require.NoError(t, err, testID)
		} else {
			require.Error(t, err, testID)
			require.Equal(t, check.Error, err.Error(), testID)
			continue
		}
		// Check that the key matched
		require.Equal(t, check.Key, info.Key, testID)

		// Now try to parse the same key again
		out, err := router.RouteFromKey(ctx, info.Key)
		require.NoError(t, err, testID)
		require.Equal(t, check.GRN, out.GRN, testID)
	}
}
