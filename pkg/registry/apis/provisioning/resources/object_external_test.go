package resources

import (
	"context"
	"errors"
	"strconv"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/client-go/dynamic"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var (
	externalPlaylistGVR = schema.GroupVersionResource{Group: playlistGVK.Group, Version: playlistGVK.Version, Resource: "playlists"}
	externalPlaylist    = SupportedResource{GroupKind: playlistKind, Capabilities: sets.New(CapabilityExternalStorage)}
	indexedDashboard    = SupportedResource{GroupKind: schema.GroupKind{Group: "dashboard.grafana.app", Kind: "Dashboard"}}
)

// pagedList serves objects in pages of the requested limit, as an API server does, and records
// every request.
type pagedList struct {
	dynamic.ResourceInterface
	objects []unstructured.Unstructured
	// list replaces the paging when set.
	list func(ctx context.Context) (*unstructured.UnstructuredList, error)

	mu       sync.Mutex
	requests []metav1.ListOptions
}

func (p *pagedList) List(ctx context.Context, opts metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	p.mu.Lock()
	p.requests = append(p.requests, opts)
	p.mu.Unlock()
	if p.list != nil {
		return p.list(ctx)
	}

	start := 0
	if opts.Continue != "" {
		start, _ = strconv.Atoi(opts.Continue)
	}
	end := len(p.objects)
	if opts.Limit > 0 {
		end = min(start+int(opts.Limit), end)
	}
	list := &unstructured.UnstructuredList{Items: p.objects[start:end]}
	if end < len(p.objects) {
		list.SetContinue(strconv.Itoa(end))
	}
	return list, nil
}

func (p *pagedList) Requests() []metav1.ListOptions {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.requests
}

// externalPlaylistLister reads playlists, stored outside unified storage, through client.
func externalPlaylistLister(t *testing.T, client dynamic.ResourceInterface) (*ResourceListerFromSearch, *resource.MockResourceClient) {
	t.Helper()
	clients := NewMockResourceClients(t)
	clients.EXPECT().SupportedResources().Return([]SupportedResource{indexedDashboard, externalPlaylist})
	clients.EXPECT().ForKind(mock.Anything, playlistKind.WithVersion("")).Return(client, externalPlaylistGVR, nil)
	factory := NewMockClientFactory(t)
	factory.EXPECT().Clients(mock.Anything, "default").Return(clients, nil)

	store := resource.NewMockResourceClient(t)
	return NewResourceLister(store, factory, []SupportedResource{indexedDashboard, externalPlaylist}), store
}

func playlists(t *testing.T, n int, repository string) []unstructured.Unstructured {
	t.Helper()
	out := make([]unstructured.Unstructured, 0, n)
	for i := range n {
		name := "pl-" + strconv.Itoa(i)
		out = append(out, *managedDataSource(t, playlistGVK, name, repository, name+".json"))
	}
	return out
}

func noIndexedObjects(store *resource.MockResourceClient) {
	store.EXPECT().ListManagedObjects(mock.Anything, mock.Anything).Return(&resourcepb.ListManagedObjectsResponse{}, nil).Maybe()
	store.EXPECT().CountManagedObjects(mock.Anything, mock.Anything).Return(&resourcepb.CountManagedObjectsResponse{}, nil).Maybe()
	store.EXPECT().GetStats(mock.Anything, mock.Anything).Return(&resourcepb.ResourceStatsResponse{}, nil).Maybe()
}

// A large kind is read in pages of a bounded size and folded into counts as it goes, so a stats
// request holds one page of it at a time rather than the whole kind.
func TestResourceListerFromSearch_ReadsALargeExternalKindInPages(t *testing.T) {
	const repository = "repo"
	objects := append(playlists(t, 240, repository), playlists(t, 10, "another-repo")...)

	t.Run("stats", func(t *testing.T) {
		paged := &pagedList{objects: objects}
		lister, store := externalPlaylistLister(t, paged)
		noIndexedObjects(store)

		got, err := lister.Stats(context.Background(), "default")
		require.NoError(t, err)
		require.Equal(t, []provisioning.ResourceCount{{Group: playlistGVK.Group, Resource: "playlists", Count: 250}}, got.Instance)
		require.Empty(t, got.Unmanaged)
		require.ElementsMatch(t, []provisioning.ManagerStats{
			{Kind: utils.ManagerKindRepo, Identity: repository, Stats: []provisioning.ResourceCount{{Group: playlistGVK.Group, Resource: "playlists", Count: 240}}},
			{Kind: utils.ManagerKindRepo, Identity: "another-repo", Stats: []provisioning.ResourceCount{{Group: playlistGVK.Group, Resource: "playlists", Count: 10}}},
		}, got.Managed)
		require.Equal(t, []metav1.ListOptions{
			{Limit: 100}, {Limit: 100, Continue: "100"}, {Limit: 100, Continue: "200"},
		}, paged.Requests())
	})

	t.Run("a page past the kind does not read it", func(t *testing.T) {
		paged := &pagedList{objects: objects}
		lister, store := externalPlaylistLister(t, paged)
		noIndexedObjects(store)
		past := resourceListKey{Group: "zzz.grafana.app", Resource: "things", Name: "a"}.encode()

		got, err := lister.List(context.Background(), "default", repository, ListOptions{Limit: 10, Continue: past})
		require.NoError(t, err)
		require.Empty(t, got.Items)
		require.Empty(t, paged.Requests(), "every playlist sorts before the token, so none can be on the page")
	})

	t.Run("a page within the kind still reads it", func(t *testing.T) {
		paged := &pagedList{objects: objects}
		lister, store := externalPlaylistLister(t, paged)
		noIndexedObjects(store)
		within := resourceListKey{Group: playlistGVK.Group, Resource: "playlists", Name: "pl-0"}.encode()

		got, err := lister.List(context.Background(), "default", repository, ListOptions{Limit: 1, Continue: within})
		require.NoError(t, err)
		require.Equal(t, "pl-1", got.Items[0].Name)
		require.Len(t, paged.Requests(), 3)
	})
}

func TestResourceListerFromSearch_CancelsTheOtherReads(t *testing.T) {
	indexErr := errors.New("index unavailable")

	// The external read only returns once its context is cancelled. Without cancellation it never
	// would, and the bubble would deadlock.
	t.Run("an index failure cancels the external read", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			started := make(chan struct{})
			blocked := &pagedList{list: func(ctx context.Context) (*unstructured.UnstructuredList, error) {
				close(started)
				<-ctx.Done()
				return nil, ctx.Err()
			}}
			lister, store := externalPlaylistLister(t, blocked)
			store.EXPECT().CountManagedObjects(mock.Anything, mock.Anything).
				RunAndReturn(func(context.Context, *resourcepb.CountManagedObjectsRequest, ...grpc.CallOption) (*resourcepb.CountManagedObjectsResponse, error) {
					<-started
					return nil, indexErr
				}).Once()

			_, err := lister.RepositoryStats(t.Context(), "default", "repo")
			require.Same(t, indexErr, err, "the index's error is returned as is, not the cancellation it caused")
		})
	})

	// A transient error puts the external read to sleep before its next attempt. The sleep has to
	// end with the cancellation: otherwise the request waits out the backoff, which grows to 5s.
	t.Run("a cancelled read stops retrying at once", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			attempted := make(chan struct{})
			var once sync.Once
			unavailable := &pagedList{list: func(context.Context) (*unstructured.UnstructuredList, error) {
				once.Do(func() { close(attempted) })
				return nil, apierrors.NewServiceUnavailable("starting")
			}}
			lister, store := externalPlaylistLister(t, newRetryResourceInterface(unavailable, defaultRetryBackoff()))
			store.EXPECT().CountManagedObjects(mock.Anything, mock.Anything).
				RunAndReturn(func(context.Context, *resourcepb.CountManagedObjectsRequest, ...grpc.CallOption) (*resourcepb.CountManagedObjectsResponse, error) {
					<-attempted
					return nil, indexErr
				}).Once()

			start := time.Now()
			_, err := lister.RepositoryStats(t.Context(), "default", "repo")
			require.Same(t, indexErr, err)
			require.Zero(t, time.Since(start), "no backoff is waited out after the cancellation")
			require.Len(t, unavailable.Requests(), 1)
		})
	})

	t.Run("the caller's cancellation reaches the external read", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			ctx, cancel := context.WithCancel(t.Context())
			blocked := &pagedList{list: func(ctx context.Context) (*unstructured.UnstructuredList, error) {
				cancel()
				<-ctx.Done()
				return nil, ctx.Err()
			}}
			lister, store := externalPlaylistLister(t, blocked)
			noIndexedObjects(store)

			_, err := lister.List(ctx, "default", "repo", ListOptions{})
			require.ErrorIs(t, err, context.Canceled)
		})
	})
}

// servingProvider serves one kind from one API server, or fails discovery for it.
type servingProvider struct {
	client.DiscoveryClient
	dynamic      dynamic.Interface
	discoveryErr error
	calls        int
}

func (p *servingProvider) GetClientsForKind(context.Context, schema.GroupVersionKind) (dynamic.Interface, client.DiscoveryClient, error) {
	p.calls++
	return p.dynamic, p, nil
}

func (p *servingProvider) GetClientsForResource(context.Context, schema.GroupVersionResource) (dynamic.Interface, client.DiscoveryClient, error) {
	return p.dynamic, p, nil
}

func (p *servingProvider) GetPreferredVersionForKind(_ context.Context, gk schema.GroupKind) (schema.GroupVersionResource, schema.GroupVersionKind, error) {
	if p.discoveryErr != nil {
		return schema.GroupVersionResource{}, schema.GroupVersionKind{}, p.discoveryErr
	}
	return externalPlaylistGVR, gk.WithVersion(externalPlaylistGVR.Version), nil
}

// fakeDynamic hands out one resource client whatever is asked of it.
type fakeDynamic struct {
	dynamic.Interface
	resource dynamic.ResourceInterface
}

func (f fakeDynamic) Resource(schema.GroupVersionResource) dynamic.NamespaceableResourceInterface {
	return fakeNamespaceable{f.resource}
}

type fakeNamespaceable struct{ dynamic.ResourceInterface }

func (f fakeNamespaceable) Namespace(string) dynamic.ResourceInterface { return f.ResourceInterface }

// Each group is resolved on the API server registered for it, through the real multi-server
// factory: an external kind on its own server is read there, and that server failing fails the
// request instead of dropping the kind from it.
func TestResourceListerFromSearch_ReadsAnExternalKindOnItsOwnAPIServer(t *testing.T) {
	const repository = "repo"
	configured := []SupportedResource{indexedDashboard, externalPlaylist}
	listerOn := func(servers map[string]clientsProvider) (*ResourceListerFromSearch, *resource.MockResourceClient) {
		factories := make(map[string]ClientFactory, len(servers))
		for group, provider := range servers {
			factories[group] = &clientFactory{
				clientsProvider:           provider,
				supportedResourceProvider: NewSupportedResourceProvider(configured),
				storageGroup:              group,
			}
		}
		store := resource.NewMockResourceClient(t)
		return NewResourceLister(store, &multiClientFactory{clientFactories: factories}, configured), store
	}
	playlistServer := func() *servingProvider {
		return &servingProvider{dynamic: fakeDynamic{resource: &pagedList{objects: playlists(t, 2, repository)}}}
	}

	t.Run("reads the kind on its server and leaves the others alone", func(t *testing.T) {
		dashboards := &flakyClientsProvider{err: errors.New("dashboard server down")}
		lister, store := listerOn(map[string]clientsProvider{
			indexedDashboard.Group: dashboards,
			playlistKind.Group:     playlistServer(),
		})
		store.EXPECT().ListManagedObjects(mock.Anything, mock.Anything).Return(&resourcepb.ListManagedObjectsResponse{
			Items: []*resourcepb.ListManagedObjectsResponse_Item{
				{Object: &resourcepb.ResourceKey{Group: indexedDashboard.Group, Resource: "dashboards", Name: "db-1"}, Path: "db-1.json"},
			},
		}, nil).Once()

		got, err := lister.List(context.Background(), "default", repository, ListOptions{})
		require.NoError(t, err)
		require.Len(t, got.Items, 3)
		require.Equal(t, "db-1", got.Items[0].Name)
		require.Equal(t, []string{"pl-0", "pl-1"}, []string{got.Items[1].Name, got.Items[2].Name})
		require.Zero(t, dashboards.calls, "an indexed kind's server is not asked anything")
	})

	t.Run("a discovery failure on the kind's server fails the request", func(t *testing.T) {
		server := playlistServer()
		server.discoveryErr = errors.New("playlist.grafana.app/v0alpha1 not served")
		lister, store := listerOn(map[string]clientsProvider{indexedDashboard.Group: &flakyClientsProvider{}, playlistKind.Group: server})
		noIndexedObjects(store)

		_, err := lister.List(context.Background(), "default", repository, ListOptions{})
		require.ErrorIs(t, err, server.discoveryErr)
		require.ErrorContains(t, err, "get client for Playlist.playlist.grafana.app")

		_, err = lister.Stats(context.Background(), "default")
		require.ErrorIs(t, err, server.discoveryErr, "stats fail too rather than leave the kind out of the counts")
	})

	t.Run("a kind with no server registered fails the request", func(t *testing.T) {
		lister, store := listerOn(map[string]clientsProvider{indexedDashboard.Group: &flakyClientsProvider{}})
		noIndexedObjects(store)

		_, err := lister.RepositoryStats(context.Background(), "default", repository)
		require.ErrorContains(t, err, "no clients provider for group playlist.grafana.app")
	})
}
