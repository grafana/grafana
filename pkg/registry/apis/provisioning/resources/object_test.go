package resources

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"
	dynamicfake "k8s.io/client-go/dynamic/fake"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	provisioningresources "github.com/grafana/grafana/apps/provisioning/pkg/resources"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// repoManager is what every row of a repository-scoped list reports, the list being
// scoped to one repository by definition.
var repoManager = &provisioning.ResourceManager{Kind: utils.ManagerKindRepo, Identity: "repo"}

func TestResourceListerFromSearch_ListErrors(t *testing.T) {
	for _, tc := range resourceErrorCases(t) {
		t.Run(tc.name, func(t *testing.T) {
			store := resource.NewMockResourceClient(t)
			store.EXPECT().ListManagedObjects(mock.Anything, mock.Anything).Return(nil, tc.err).Once()
			got, err := NewResourceLister(store, nil, nil).List(context.Background(), "default", "repo")
			require.Nil(t, got)
			tc.assertError(t, err)
		})
	}
}

func TestResourceListerFromSearch_CountErrors(t *testing.T) {
	for _, tc := range resourceErrorCases(t) {
		t.Run(tc.name, func(t *testing.T) {
			store := resource.NewMockResourceClient(t)
			store.EXPECT().CountManagedObjects(mock.Anything, mock.Anything).Return(nil, tc.err).Once()
			got, err := NewResourceLister(store, nil, nil).Stats(context.Background(), "default", "")
			require.Nil(t, got)
			tc.assertError(t, err)
		})
	}
}

func TestResourceListerFromSearch_GetStatsErrors(t *testing.T) {
	for _, tc := range resourceErrorCases(t) {
		t.Run(tc.name, func(t *testing.T) {
			store := resource.NewMockResourceClient(t)
			store.EXPECT().CountManagedObjects(mock.Anything, mock.Anything).Return(&resourcepb.CountManagedObjectsResponse{}, nil).Once()
			store.EXPECT().GetStats(mock.Anything, mock.Anything).Return(nil, tc.err).Once()
			got, err := NewResourceLister(store, nil, nil).Stats(context.Background(), "default", "")
			require.Nil(t, got)
			tc.assertError(t, err)
		})
	}
}

type resourceErrorCase struct {
	name string
	err  error
}

func resourceErrorCases(t *testing.T) []resourceErrorCase {
	t.Helper()
	result := &resourcepb.ErrorResult{Code: http.StatusNotFound, Reason: string(metav1.StatusReasonNotFound), Message: "not found"}
	st, err := status.New(codes.Internal, "outer error").WithDetails(result)
	require.NoError(t, err)
	return []resourceErrorCase{
		{name: "grpc details", err: st.Err()},
		{name: "wrapped grpc", err: fmt.Errorf("storage: %w", st.Err())},
		{name: "unstructured grpc", err: status.Error(codes.Unavailable, "backend connection failed")},
		{name: "ordinary transport", err: errors.New("transport failed")},
	}
}

func (tc resourceErrorCase) assertError(t *testing.T, err error) {
	t.Helper()
	// Go callers get the returned error untouched, keeping its gRPC status and details.
	require.Same(t, tc.err, err)
}

func TestResourceListerFromSearch_ListsCollectionMembersThroughClients(t *testing.T) {
	const (
		repository = "repo"
		collection = "datasource.grafana.app"
		member     = "grafana-testdata-datasource." + collection
	)
	memberGVR := schema.GroupVersionResource{Group: member, Version: "v0alpha1", Resource: "datasources"}
	memberGVK := schema.GroupVersionKind{Group: member, Version: "v0alpha1", Kind: "DataSource"}

	// The index reports a stored member under the collection, which no API server serves.
	store := resource.NewMockResourceClient(t)
	store.EXPECT().ListManagedObjects(mock.Anything, mock.Anything).Return(&resourcepb.ListManagedObjectsResponse{
		Items: []*resourcepb.ListManagedObjectsResponse_Item{
			{Object: &resourcepb.ResourceKey{Group: collection, Resource: "datasources", Name: "ds-1"}, Path: "ds-1.json"},
			{Object: &resourcepb.ResourceKey{Group: "playlist.grafana.app", Resource: "playlists", Name: "pl-1"}, Path: "pl-1.json", Title: "Playlist 1"},
		},
	}, nil).Once()

	scheme := runtime.NewScheme()
	listGVK := memberGVK
	listGVK.Kind += "List"
	scheme.AddKnownTypeWithName(listGVK, &unstructured.UnstructuredList{})
	scheme.AddKnownTypeWithName(memberGVK, &unstructured.Unstructured{})
	dyn := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(scheme,
		map[schema.GroupVersionResource]string{memberGVR: listGVK.Kind},
		managedDataSource(t, memberGVK, "ds-1", repository, "ds-1.json"),
		managedDataSource(t, memberGVK, "ds-2", "another-repo", "ds-2.json"),
	)

	clients := NewMockResourceClients(t)
	clients.EXPECT().SupportedResources().Return([]SupportedResource{
		{GroupKind: memberGVK.GroupKind()},
		{GroupKind: schema.GroupKind{Group: "playlist.grafana.app", Kind: "Playlist"}},
	})
	clients.EXPECT().ForKind(mock.Anything, memberGVK.GroupKind().WithVersion("")).
		Return(dyn.Resource(memberGVR).Namespace("default"), memberGVR, nil).Once()

	factory := NewMockClientFactory(t)
	factory.EXPECT().Clients(mock.Anything, "default").Return(clients, nil).Once()

	lister := NewResourceLister(store, factory, []SupportedResource{
		{GroupKind: schema.GroupKind{Group: provisioningresources.CollectionPrefix + collection, Kind: "DataSource"}},
	})

	got, err := lister.List(context.Background(), "default", repository)
	require.NoError(t, err)
	require.Equal(t, []provisioning.ResourceListItem{
		{Path: "pl-1.json", Group: "playlist.grafana.app", Resource: "playlists", Name: "pl-1", Title: "Playlist 1", Manager: repoManager},
		{Path: "ds-1.json", Group: member, Resource: "datasources", Name: "ds-1", Hash: "abc", Title: "Test data", Manager: repoManager},
	}, got.Items, "the collection's index item is replaced by the one addressed through its served group")
}

func managedDataSource(t *testing.T, gvk schema.GroupVersionKind, name, repository, path string) *unstructured.Unstructured {
	t.Helper()
	obj := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": gvk.GroupVersion().String(),
		"kind":       gvk.Kind,
		"metadata":   map[string]any{"name": name, "namespace": "default"},
		"spec":       map[string]any{"title": "Test data"},
	}}
	meta, err := utils.MetaAccessor(obj)
	require.NoError(t, err)
	meta.SetManagerProperties(utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: repository})
	meta.SetSourceProperties(utils.SourceProperties{Path: path, Checksum: "abc"})
	return obj
}

// A pattern can cover the group of a kind declared on its own. Reporting that kind from the index
// and listing it as a collection member too puts the same resource at one path twice, which full
// sync deletes as an orphan duplicate.
func TestResourceListerFromSearch_ListsAMemberOnceWhenAPatternCoversADeclaredKind(t *testing.T) {
	const repository = "repo"
	playlistGVR := schema.GroupVersionResource{Group: "playlist.grafana.app", Version: "v0alpha1", Resource: "playlists"}
	playlistGVK := schema.GroupVersionKind{Group: "playlist.grafana.app", Version: "v0alpha1", Kind: "Playlist"}
	dashboardGK := schema.GroupKind{Group: "dashboard.grafana.app", Kind: "Dashboard"}

	store := resource.NewMockResourceClient(t)
	store.EXPECT().ListManagedObjects(mock.Anything, mock.Anything).Return(&resourcepb.ListManagedObjectsResponse{
		Items: []*resourcepb.ListManagedObjectsResponse_Item{
			{Object: &resourcepb.ResourceKey{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "db-1"}, Path: "db-1.json", Title: "Dashboard 1"},
			{Object: &resourcepb.ResourceKey{Group: "playlist.grafana.app", Resource: "playlists", Name: "pl-1"}, Path: "pl-1.json", Title: "Playlist 1"},
		},
	}, nil).Once()

	scheme := runtime.NewScheme()
	listGVK := playlistGVK
	listGVK.Kind += "List"
	scheme.AddKnownTypeWithName(listGVK, &unstructured.UnstructuredList{})
	scheme.AddKnownTypeWithName(playlistGVK, &unstructured.Unstructured{})
	dyn := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(scheme,
		map[schema.GroupVersionResource]string{playlistGVR: listGVK.Kind},
		managedDataSource(t, playlistGVK, "pl-1", repository, "pl-1.json"),
	)

	clients := NewMockResourceClients(t)
	clients.EXPECT().SupportedResources().Return([]SupportedResource{
		{GroupKind: dashboardGK},
		{GroupKind: playlistGVK.GroupKind(), Collection: "grafana.app"},
	})
	// Only the kind the pattern was configured for is listed through its API group; the dashboard
	// is not a member of *.grafana.app/Playlist and stays on the index.
	clients.EXPECT().ForKind(mock.Anything, playlistGVK.GroupKind().WithVersion("")).
		Return(dyn.Resource(playlistGVR).Namespace("default"), playlistGVR, nil).Once()

	factory := NewMockClientFactory(t)
	factory.EXPECT().Clients(mock.Anything, "default").Return(clients, nil).Once()

	lister := NewResourceLister(store, factory, []SupportedResource{
		{GroupKind: dashboardGK},
		{GroupKind: schema.GroupKind{Group: "*.grafana.app", Kind: "Playlist"}},
	})

	got, err := lister.List(context.Background(), "default", repository)
	require.NoError(t, err)
	require.Equal(t, []provisioning.ResourceListItem{
		{Path: "db-1.json", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "db-1", Title: "Dashboard 1", Manager: repoManager},
		{Path: "pl-1.json", Group: "playlist.grafana.app", Resource: "playlists", Name: "pl-1", Hash: "abc", Title: "Test data", Manager: repoManager},
	}, got.Items)
}

// A kind declared on its own can be stored in a group a collection also names. Dropping every
// indexed object under that group took the declared kind with it, and the delete and release
// finalizers then left those resources behind.
func TestResourceListerFromSearch_KeepsADeclaredKindStoredInACollectionGroup(t *testing.T) {
	const (
		repository = "repo"
		collection = "dashboard.grafana.app"
	)
	panelGVR := schema.GroupVersionResource{Group: collection, Version: "v0alpha1", Resource: "librarypanels"}
	panelGVK := schema.GroupVersionKind{Group: collection, Version: "v0alpha1", Kind: "LibraryPanel"}
	dashboardGK := schema.GroupKind{Group: collection, Kind: "Dashboard"}

	store := resource.NewMockResourceClient(t)
	store.EXPECT().ListManagedObjects(mock.Anything, mock.Anything).Return(&resourcepb.ListManagedObjectsResponse{
		Items: []*resourcepb.ListManagedObjectsResponse_Item{
			{Object: &resourcepb.ResourceKey{Group: collection, Resource: "dashboards", Name: "db-1"}, Path: "db-1.json", Title: "Dashboard 1"},
			{Object: &resourcepb.ResourceKey{Group: collection, Resource: "librarypanels", Name: "lp-1"}, Path: "lp-1.json", Title: "Panel 1"},
		},
	}, nil).Once()

	scheme := runtime.NewScheme()
	listGVK := panelGVK
	listGVK.Kind += "List"
	scheme.AddKnownTypeWithName(listGVK, &unstructured.UnstructuredList{})
	scheme.AddKnownTypeWithName(panelGVK, &unstructured.Unstructured{})
	dyn := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(scheme,
		map[schema.GroupVersionResource]string{panelGVR: listGVK.Kind},
		managedDataSource(t, panelGVK, "lp-1", repository, "lp-1.json"),
	)

	clients := NewMockResourceClients(t)
	clients.EXPECT().SupportedResources().Return([]SupportedResource{
		{GroupKind: dashboardGK},
		{GroupKind: panelGVK.GroupKind(), Collection: collection},
	})
	clients.EXPECT().ForKind(mock.Anything, panelGVK.GroupKind().WithVersion("")).
		Return(dyn.Resource(panelGVR).Namespace("default"), panelGVR, nil).Once()
	// Resolved to tell the declared kind's rows apart from the collection's, not to list them.
	clients.EXPECT().ForKind(mock.Anything, dashboardGK.WithVersion("")).
		Return(nil, schema.GroupVersionResource{Group: collection, Version: "v1", Resource: "dashboards"}, nil).Once()

	factory := NewMockClientFactory(t)
	factory.EXPECT().Clients(mock.Anything, "default").Return(clients, nil).Once()

	lister := NewResourceLister(store, factory, []SupportedResource{
		{GroupKind: dashboardGK},
		{GroupKind: schema.GroupKind{Group: provisioningresources.CollectionWildcard + provisioningresources.CollectionSeparator + collection, Kind: "LibraryPanel"}},
	})

	got, err := lister.List(context.Background(), "default", repository)
	require.NoError(t, err)
	require.Equal(t, []provisioning.ResourceListItem{
		{Path: "db-1.json", Group: collection, Resource: "dashboards", Name: "db-1", Title: "Dashboard 1", Manager: repoManager},
		{Path: "lp-1.json", Group: collection, Resource: "librarypanels", Name: "lp-1", Hash: "abc", Title: "Test data", Manager: repoManager},
	}, got.Items)
}

// A disabled kind is absent from the active set the member scan walks, so dropping every index row
// under a collection's group took it along: repository delete and release then left those objects
// behind, still managed by a repository that is gone.
func TestResourceListerFromSearch_KeepsADisabledKindStoredInACollectionGroup(t *testing.T) {
	const (
		repository = "repo"
		collection = "dashboard.grafana.app"
	)
	panelGVR := schema.GroupVersionResource{Group: collection, Version: "v0alpha1", Resource: "librarypanels"}
	panelGVK := schema.GroupVersionKind{Group: collection, Version: "v0alpha1", Kind: "LibraryPanel"}
	dashboardGK := schema.GroupKind{Group: collection, Kind: "Dashboard"}

	store := resource.NewMockResourceClient(t)
	store.EXPECT().ListManagedObjects(mock.Anything, mock.Anything).Return(&resourcepb.ListManagedObjectsResponse{
		Items: []*resourcepb.ListManagedObjectsResponse_Item{
			{Object: &resourcepb.ResourceKey{Group: collection, Resource: "dashboards", Name: "db-1"}, Path: "db-1.json", Title: "Dashboard 1"},
		},
	}, nil).Once()

	scheme := runtime.NewScheme()
	listGVK := panelGVK
	listGVK.Kind += "List"
	scheme.AddKnownTypeWithName(listGVK, &unstructured.UnstructuredList{})
	scheme.AddKnownTypeWithName(panelGVK, &unstructured.Unstructured{})
	dyn := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(scheme,
		map[schema.GroupVersionResource]string{panelGVR: listGVK.Kind})

	// Dashboards are declared as disabled, so the expanded active set leaves them out.
	clients := NewMockResourceClients(t)
	clients.EXPECT().SupportedResources().Return([]SupportedResource{
		{GroupKind: panelGVK.GroupKind(), Collection: collection},
	})
	clients.EXPECT().ForKind(mock.Anything, panelGVK.GroupKind().WithVersion("")).
		Return(dyn.Resource(panelGVR).Namespace("default"), panelGVR, nil).Once()
	clients.EXPECT().ForKind(mock.Anything, dashboardGK.WithVersion("")).
		Return(nil, schema.GroupVersionResource{Group: collection, Version: "v1", Resource: "dashboards"}, nil).Once()

	factory := NewMockClientFactory(t)
	factory.EXPECT().Clients(mock.Anything, "default").Return(clients, nil).Once()

	lister := NewResourceLister(store, factory, []SupportedResource{
		{GroupKind: dashboardGK, Capabilities: sets.New(CapabilityDisabled)},
		{GroupKind: schema.GroupKind{Group: provisioningresources.CollectionWildcard + provisioningresources.CollectionSeparator + collection, Kind: "LibraryPanel"}},
	})

	got, err := lister.List(context.Background(), "default", repository)
	require.NoError(t, err)
	require.Equal(t, []provisioning.ResourceListItem{
		{Path: "db-1.json", Group: collection, Resource: "dashboards", Name: "db-1", Title: "Dashboard 1", Manager: repoManager},
	}, got.Items, "the disabled kind is still managed, and still has to be cleaned up")
}

func TestNewResourceListerForMode(t *testing.T) {
	store := resource.NewMockResourceClient(t)

	t.Run("an absent setting keeps the index reader", func(t *testing.T) {
		lister, err := NewResourceListerForMode("", store, nil, nil)
		require.NoError(t, err)
		require.IsType(t, &ResourceListerFromSearch{}, lister)
		require.True(t, NeedsResourceStore(""))
	})

	t.Run("search", func(t *testing.T) {
		lister, err := NewResourceListerForMode(ListerSearch, store, nil, nil)
		require.NoError(t, err)
		require.IsType(t, &ResourceListerFromSearch{}, lister)
		require.True(t, NeedsResourceStore(ListerSearch))
	})

	t.Run("apis needs no store", func(t *testing.T) {
		lister, err := NewResourceListerForMode(ListerAPIs, nil, nil, nil)
		require.NoError(t, err)
		require.NotNil(t, lister)
		require.False(t, NeedsResourceStore(ListerAPIs))
	})

	t.Run("an unknown mode names the valid values", func(t *testing.T) {
		_, err := NewResourceListerForMode("index", store, nil, nil)
		require.EqualError(t, err, `invalid [provisioning] resource_lister "index": expected "search" or "apis"`)
		require.False(t, NeedsResourceStore("index"), "an unknown mode must fail validation, not a store lookup")
	})
}
