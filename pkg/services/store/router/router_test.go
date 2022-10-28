package router

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/store/kind"
	"github.com/grafana/grafana/pkg/services/store/object"
	"github.com/stretchr/testify/require"
)

func TestSimpleRouter(t *testing.T) {
	ctx := context.Background()
	router := &standardStoreRouter{
		kinds: kind.NewKindRegistry(),
	}
	info, err := router.Route(ctx, &object.GRN{
		UID: "path/to/file",
	})
	require.Error(t, err) // needs OrgID

	type routeScenario struct {
		GRN   *object.GRN
		Error string
		Key   string
	}

	scenarios := []routeScenario{{
		Error: "missing TenantId",
		GRN:   &object.GRN{Scope: "x"},
	}, {
		Error: "unknown Kind: xyz",
		GRN: &object.GRN{
			TenantId: 11,
			Scope:    models.ObjectStoreScopeDrive,
			UID:      "path/to/file",
			Kind:     "xyz",
		},
	}, {
		Key: "11/drive/path/to/file-dashboard.json",
		GRN: &object.GRN{
			TenantId: 11,
			Scope:    models.ObjectStoreScopeDrive,
			UID:      "path/to/file",
			Kind:     "dashboard",
		},
	}, {
		Key: "11/drive/path/to/folder/__folder.json",
		GRN: &object.GRN{
			TenantId: 11,
			Scope:    models.ObjectStoreScopeDrive,
			UID:      "path/to/folder",
			Kind:     "folder",
		},
	}, {
		Key: "10/drive/path/to/file.png",
		GRN: &object.GRN{
			TenantId: 10,
			Scope:    models.ObjectStoreScopeDrive,
			UID:      "path/to/file",
			Kind:     "png",
		},
	}, {
		Key: "10/entity/playlist/aaaaa", // ?.json better or not?
		GRN: &object.GRN{
			TenantId: 10,
			Scope:    models.ObjectStoreScopeEntity,
			UID:      "aaaaa",
			Kind:     "playlist",
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
