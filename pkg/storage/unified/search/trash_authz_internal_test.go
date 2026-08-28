package search

import (
	"context"
	"iter"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// denyingAccessClient answers every check, so a cancelled scan is the only thing a
// test can be measuring.
type denyingAccessClient struct{ authlib.AccessClient }

func (denyingAccessClient) Check(context.Context, authlib.AuthInfo, authlib.CheckRequest, string) (authlib.CheckResponse, error) {
	return authlib.CheckResponse{Allowed: false, Zookie: authlib.NoopZookie{}}, nil
}

func (denyingAccessClient) BatchCheck(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	results := make(map[string]authlib.BatchCheckResult, len(req.Checks))
	for _, item := range req.Checks {
		results[item.CorrelationID] = authlib.BatchCheckResult{Allowed: false}
	}
	return authlib.BatchCheckResponse{Results: results}, nil
}

// A cancelled scan must say so. Left to the folder check, cancellation reads as a
// denial, and the caller gets a short page that looks like a complete one.
func TestTrashAuthorized_CancellationIsReported(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())

	authorizer := resource.NewTrashAuthorizer(
		denyingAccessClient{},
		&identity.StaticRequester{Type: authlib.TypeUser, UserUID: "carol", Namespace: "default"},
		&resourcepb.ResourceKey{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards"},
		nil,
	)

	candidates := func(yield func(docInfo) bool) {
		for i := range 3 {
			if !yield(docInfo{folder: "folder-1", deletedBy: "user:alice", name: string(rune('a' + i))}) {
				return
			}
		}
	}

	cancel()

	var err error
	for _, e := range trashAuthorized(ctx, iter.Seq[docInfo](candidates), authorizer) {
		if e != nil {
			err = e
			break
		}
	}

	require.Error(t, err)
	assert.ErrorIs(t, err, context.Canceled)
}
