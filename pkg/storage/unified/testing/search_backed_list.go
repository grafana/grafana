package test

import (
	"context"
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// The test selects on labels only, which any group may do, so the group here is
// just a realistic one.
const (
	searchBackedListGroup    = "playlist.grafana.app"
	searchBackedListResource = "playlists"
)

// SearchBackedListOptions tunes assertions that only hold for some backends.
type SearchBackedListOptions struct {
	// ExpectBatchReads asserts the read used BatchReadResource (KV backends)
	// rather than the per-resource fallback.
	ExpectBatchReads bool
}

// labelFolderBuilder indexes the fields this test selects and authorizes on:
// title, labels, and folder. The shared TestDocumentBuilderSupplier indexes
// none of these.
type labelFolderBuilder struct{}

func (labelFolderBuilder) BuildDocument(_ context.Context, key *resourcepb.ResourceKey, rv int64, value []byte) (*resource.IndexableDocument, error) {
	var u unstructured.Unstructured
	if err := u.UnmarshalJSON(value); err != nil {
		return nil, err
	}
	meta, err := utils.MetaAccessor(&u)
	if err != nil {
		return nil, err
	}
	title, _, _ := unstructured.NestedString(u.Object, "spec", "title")
	return &resource.IndexableDocument{
		Key:    &resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: u.GetName()},
		Name:   u.GetName(),
		RV:     rv, // the search hit must carry the indexed revision so the read resolves that key
		Title:  title,
		Labels: u.GetLabels(),
		Folder: meta.GetFolder(),
	}, nil
}

type labelFolderBuilderSupplier struct{}

func (labelFolderBuilderSupplier) GetDocumentBuilders(_ *resource.SearchFieldsRegistry) ([]resource.DocumentBuilderInfo, error) {
	return []resource.DocumentBuilderInfo{{
		GroupResource: schema.GroupResource{Group: searchBackedListGroup, Resource: searchBackedListResource},
		Builder:       labelFolderBuilder{},
	}}, nil
}

// countingBackend counts the read paths a search-backed LIST takes so a test can
// prove it batched rather than falling back to per-resource reads.
type countingBackend struct {
	resource.StorageBackend
	batchReads atomic.Int64
	reads      atomic.Int64
}

func (c *countingBackend) BatchReadResource(ctx context.Context, reqs []*resourcepb.ReadRequest) ([]*resource.BackendReadResponse, error) {
	c.batchReads.Add(1)
	return c.StorageBackend.BatchReadResource(ctx, reqs)
}

func (c *countingBackend) ReadResource(ctx context.Context, req *resourcepb.ReadRequest) *resource.BackendReadResponse {
	c.reads.Add(1)
	return c.StorageBackend.ReadResource(ctx, req)
}

// denyFolderAccess allows everything except one folder, denying through both
// Compile (the in-searcher filter) and Check (the per-row authorizeRead) so the
// index and the List authorization agree.
type denyFolderAccess struct{ denied string }

func (a denyFolderAccess) Check(_ context.Context, _ claims.AuthInfo, _ claims.CheckRequest, folder string) (claims.CheckResponse, error) {
	return claims.CheckResponse{Allowed: folder != a.denied, Zookie: claims.NoopZookie{}}, nil
}

func (a denyFolderAccess) Compile(_ context.Context, _ claims.AuthInfo, _ claims.ListRequest) (claims.ItemChecker, claims.Zookie, error) {
	return func(_, folder string) bool { return folder != a.denied }, claims.NoopZookie{}, nil
}

func (a denyFolderAccess) BatchCheck(_ context.Context, _ claims.AuthInfo, req claims.BatchCheckRequest) (claims.BatchCheckResponse, error) {
	results := make(map[string]claims.BatchCheckResult, len(req.Checks))
	for _, c := range req.Checks {
		results[c.CorrelationID] = claims.BatchCheckResult{Allowed: c.Folder != a.denied}
	}
	return claims.BatchCheckResponse{Results: results}, nil
}

// RunTestSearchBackedList exercises the search-backed LIST path end to end
// against a real backend and a real search index: a selector LIST routes through
// search, resolves storage keys (created and updated), reads bodies, authorizes
// by folder, and paginates. Correctness runs for every backend; the batch-read
// assertions run only when opts.ExpectBatchReads is set (KV backends). A backend
// without a batched read returns ErrBatchReadUnsupported and takes the
// per-resource fallback, which this still checks for correctness.
func RunTestSearchBackedList(t *testing.T, ctx context.Context, backend resource.StorageBackend, searchBackend resource.SearchBackend, opts SearchBackedListOptions) {
	ctx = claims.WithAuthInfo(ctx, &identity.StaticRequester{
		Type:           claims.TypeUser,
		UserID:         1,
		UserUID:        "u1",
		OrgRole:        identity.RoleAdmin,
		IsGrafanaAdmin: true,
	})

	const (
		ns           = "search-list-ns"
		okFolder     = "folder-ok"
		deniedFolder = "folder-denied"
		matchTeam    = "a"
		otherTeam    = "b"
		authorized   = 55 // > searchReadChunkSize (10) so the read crosses several chunk boundaries
		unauthorized = 5
		otherLabel   = 3
	)

	counting := &countingBackend{StorageBackend: backend}

	type want struct {
		title string
		rv    int64
	}
	wantByName := map[string]want{}

	write := func(name, team, folder, title string) int64 {
		obj := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": searchBackedListGroup + "/v0alpha1",
			"kind":       "Playlist",
			"metadata": map[string]any{
				"name":      name,
				"namespace": ns,
				"labels":    map[string]any{"team": team},
			},
			"spec": map[string]any{"title": title},
		}}
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		meta.SetFolder(folder)
		value, err := obj.MarshalJSON()
		require.NoError(t, err)

		key := &resourcepb.ResourceKey{Group: searchBackedListGroup, Resource: searchBackedListResource, Namespace: ns, Name: name}
		prev := int64(0)
		if existing := backend.ReadResource(ctx, &resourcepb.ReadRequest{Key: key}); existing != nil && existing.Error == nil {
			prev = existing.ResourceVersion
		}
		evType := resourcepb.WatchEvent_ADDED
		if prev > 0 {
			evType = resourcepb.WatchEvent_MODIFIED
		}
		rv, err := backend.WriteEvent(ctx, resource.WriteEvent{
			Type:       evType,
			Key:        key,
			Value:      value,
			Object:     meta,
			PreviousRV: prev,
			GUID:       uuid.NewString(),
		})
		require.NoError(t, err)
		require.Greater(t, rv, int64(0))
		return rv
	}

	for i := 0; i < authorized; i++ {
		name := fmt.Sprintf("ok-%02d", i)
		rv := write(name, matchTeam, okFolder, "created "+name)
		wantByName[name] = want{title: "created " + name, rv: rv}
	}
	// Update a subset so the read resolves updated storage keys (new body + RV).
	for i := 0; i < 10; i++ {
		name := fmt.Sprintf("ok-%02d", i)
		rv := write(name, matchTeam, okFolder, "updated "+name)
		wantByName[name] = want{title: "updated " + name, rv: rv}
	}
	// Selector-matching but unauthorized (denied folder) — must be absent.
	for i := 0; i < unauthorized; i++ {
		write(fmt.Sprintf("denied-%02d", i), matchTeam, deniedFolder, "denied")
	}
	// Authorized but not selector-matching (other team) — must be absent.
	for i := 0; i < otherLabel; i++ {
		write(fmt.Sprintf("other-%02d", i), otherTeam, okFolder, "other")
	}

	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend:      counting,
		AccessClient: denyFolderAccess{denied: deniedFolder},
		Search: resource.SearchOptions{
			Backend:   searchBackend,
			Resources: labelFolderBuilderSupplier{},
		},
	})
	require.NoError(t, err)
	// The server runs watcher/search-maintenance goroutines; stop it before the
	// search backend is torn down (LIFO cleanup order).
	t.Cleanup(func() {
		stopCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = server.Stop(stopCtx)
	})

	newReq := func(limit int64, token string) *resourcepb.ListRequest {
		return &resourcepb.ListRequest{
			Source:        resourcepb.ListRequest_STORE,
			Limit:         limit,
			NextPageToken: token,
			Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: ns, Group: searchBackedListGroup, Resource: searchBackedListResource},
				Labels: []*resourcepb.Requirement{{Key: "team", Operator: "=", Values: []string{matchTeam}}},
			},
		}
	}

	t.Run("paginates the full authorized set with a stable resource version", func(t *testing.T) {
		got := map[string]want{}
		var token string
		var listRV int64
		pages := 0
		for {
			resp, err := server.List(ctx, newReq(10, token))
			require.NoError(t, err)
			require.Nil(t, resp.Error)
			require.Greater(t, resp.ResourceVersion, int64(0))
			if listRV == 0 {
				listRV = resp.ResourceVersion
			}
			require.Equal(t, listRV, resp.ResourceVersion, "list resource version must be stable across pages")

			for _, item := range resp.Items {
				obj := &unstructured.Unstructured{}
				require.NoError(t, obj.UnmarshalJSON(item.Value))
				name := obj.GetName()
				_, dup := got[name]
				require.False(t, dup, "duplicate across pages: %s", name)
				title, _, _ := unstructured.NestedString(obj.Object, "spec", "title")
				got[name] = want{title: title, rv: item.ResourceVersion}
			}

			pages++
			require.LessOrEqual(t, pages, authorized, "pagination did not terminate")
			token = resp.NextPageToken
			if token == "" {
				break
			}
		}

		require.Greater(t, pages, 1, "expected multiple pages")
		require.Equal(t, wantByName, got, "exact names, bodies, and updated resource versions")
	})

	t.Run("returns the whole authorized set on a single large page", func(t *testing.T) {
		counting.batchReads.Store(0)
		counting.reads.Store(0)

		resp, err := server.List(ctx, newReq(1000, ""))
		require.NoError(t, err)
		require.Nil(t, resp.Error)
		require.Empty(t, resp.NextPageToken, "the whole set fits on one page")
		require.Len(t, resp.Items, authorized)

		if opts.ExpectBatchReads {
			// Compile filters the denied folder during search, so 55 hits reach the
			// body reads: six batched reads over a 10-item chunk, no single reads.
			require.Equal(t, int64(6), counting.batchReads.Load())
			require.Equal(t, int64(0), counting.reads.Load())
		}
	})
}
