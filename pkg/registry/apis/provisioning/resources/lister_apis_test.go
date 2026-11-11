package resources

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"
	dynamicfake "k8s.io/client-go/dynamic/fake"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	provisioningresources "github.com/grafana/grafana/apps/provisioning/pkg/resources"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

var (
	dashboardKindGVK = schema.GroupVersionKind{Group: "dashboard.grafana.app", Version: "v1beta1", Kind: "Dashboard"}
	dashboardKindGVR = schema.GroupVersionResource{Group: "dashboard.grafana.app", Version: "v1beta1", Resource: "dashboards"}
	playlistKindGVK  = schema.GroupVersionKind{Group: "playlist.grafana.app", Version: "v0alpha1", Kind: "Playlist"}
	playlistKindGVR  = schema.GroupVersionResource{Group: "playlist.grafana.app", Version: "v0alpha1", Resource: "playlists"}
)

func TestResourceListerFromAPIs_ListsManagedObjectsThroughServingGroups(t *testing.T) {
	const repository = "repo"
	_, factory := apiListerClients(t, map[kindPair][]*unstructured.Unstructured{
		{dashboardKindGVK, dashboardKindGVR}: {
			managedObject(t, dashboardKindGVK, "db-1", utils.ManagerKindRepo, repository, "b.json"),
			managedObject(t, dashboardKindGVK, "db-2", utils.ManagerKindRepo, "other-repo", "x.json"),
			plainObject(t, dashboardKindGVK, "db-3"),
		},
		{playlistKindGVK, playlistKindGVR}: {
			managedObject(t, playlistKindGVK, "pl-1", utils.ManagerKindRepo, repository, "a.json"),
		},
	})

	got, err := NewAPIResourceLister(factory, configuredKinds()).List(context.Background(), "default", repository)
	require.NoError(t, err)
	require.Equal(t, []provisioning.ResourceListItem{
		{Path: "a.json", Group: playlistKindGVR.Group, Resource: "playlists", Name: "pl-1", Hash: "abc", Title: "Test data"},
		{Path: "b.json", Group: dashboardKindGVR.Group, Resource: "dashboards", Name: "db-1", Hash: "abc", Title: "Test data"},
	}, got.Items, "only this repository's objects, ordered by path")
}

func TestResourceListerFromAPIs_StatsCountsManagedAndUnmanaged(t *testing.T) {
	_, factory := apiListerClients(t, map[kindPair][]*unstructured.Unstructured{
		{dashboardKindGVK, dashboardKindGVR}: {
			managedObject(t, dashboardKindGVK, "db-1", utils.ManagerKindRepo, "repo", "a.json"),
			managedObject(t, dashboardKindGVK, "db-2", utils.ManagerKindTerraform, "tf", "b.json"),
			plainObject(t, dashboardKindGVK, "db-3"),
			plainObject(t, dashboardKindGVK, "db-4"),
		},
		{playlistKindGVK, playlistKindGVR}: {
			plainObject(t, playlistKindGVK, "pl-1"),
		},
	})

	got, err := NewAPIResourceLister(factory, configuredKinds()).Stats(context.Background(), "default", "")
	require.NoError(t, err)
	require.Equal(t, []provisioning.ManagerStats{
		{Kind: utils.ManagerKindRepo, Identity: "repo", Stats: []provisioning.ResourceCount{
			{Group: dashboardKindGVR.Group, Resource: "dashboards", Count: 1},
		}},
		{Kind: utils.ManagerKindTerraform, Identity: "tf", Stats: []provisioning.ResourceCount{
			{Group: dashboardKindGVR.Group, Resource: "dashboards", Count: 1},
		}},
	}, got.Managed)
	require.Equal(t, []provisioning.ResourceCount{
		{Group: dashboardKindGVR.Group, Resource: "dashboards", Count: 4},
		{Group: playlistKindGVR.Group, Resource: "playlists", Count: 1},
	}, got.Instance)
	require.Equal(t, []provisioning.ResourceCount{
		{Group: dashboardKindGVR.Group, Resource: "dashboards", Count: 2},
		{Group: playlistKindGVR.Group, Resource: "playlists", Count: 1},
	}, got.Unmanaged, "every manager counts against the instance total, not just repositories")
}

func TestResourceListerFromAPIs_StatsForOneRepositoryOmitsInstanceCounts(t *testing.T) {
	_, factory := apiListerClients(t, map[kindPair][]*unstructured.Unstructured{
		{dashboardKindGVK, dashboardKindGVR}: {
			managedObject(t, dashboardKindGVK, "db-1", utils.ManagerKindRepo, "repo", "a.json"),
			managedObject(t, dashboardKindGVK, "db-2", utils.ManagerKindRepo, "other-repo", "b.json"),
			plainObject(t, dashboardKindGVK, "db-3"),
		},
		{playlistKindGVK, playlistKindGVR}: {},
	})

	got, err := NewAPIResourceLister(factory, configuredKinds()).Stats(context.Background(), "default", "repo")
	require.NoError(t, err)
	require.Equal(t, []provisioning.ManagerStats{
		{Kind: utils.ManagerKindRepo, Identity: "repo", Stats: []provisioning.ResourceCount{
			{Group: dashboardKindGVR.Group, Resource: "dashboards", Count: 1},
		}},
	}, got.Managed, "the sync worker expects exactly one entry for a named repository")
	require.Nil(t, got.Instance)
	require.Nil(t, got.Unmanaged)
}

// A kind can be configured, disabled, and never served — listing must still answer for the rest.
func TestResourceListerFromAPIs_SkipsDisabledKindNoGroupServes(t *testing.T) {
	absent := schema.GroupKind{Group: "absent.grafana.app", Kind: "Gone"}
	clients, factory := apiListerClients(t, map[kindPair][]*unstructured.Unstructured{
		{dashboardKindGVK, dashboardKindGVR}: {
			managedObject(t, dashboardKindGVK, "db-1", utils.ManagerKindRepo, "repo", "a.json"),
		},
		{playlistKindGVK, playlistKindGVR}: {},
	})
	clients.EXPECT().ForKind(mock.Anything, absent.WithVersion("")).
		Return(nil, schema.GroupVersionResource{}, &meta.NoKindMatchError{GroupKind: absent}).Once()

	configured := append(configuredKinds(), SupportedResource{GroupKind: absent, Capabilities: sets.New(CapabilityDisabled)})
	got, err := NewAPIResourceLister(factory, configured).List(context.Background(), "default", "repo")
	require.NoError(t, err)
	require.Len(t, got.Items, 1)
}

func TestResourceListerFromAPIs_FailsOnAnActiveKindNoGroupServes(t *testing.T) {
	clients := NewMockResourceClients(t)
	clients.EXPECT().SupportedResources().Return([]SupportedResource{{GroupKind: dashboardKindGVK.GroupKind()}})
	clients.EXPECT().ForKind(mock.Anything, dashboardKindGVK.GroupKind().WithVersion("")).
		Return(nil, schema.GroupVersionResource{}, &meta.NoKindMatchError{GroupKind: dashboardKindGVK.GroupKind()}).Once()
	factory := NewMockClientFactory(t)
	factory.EXPECT().Clients(mock.Anything, "default").Return(clients, nil).Once()

	_, err := NewAPIResourceLister(factory, configuredKinds()).List(context.Background(), "default", "repo")
	require.ErrorContains(t, err, "get client for")
}

// A collection's members are listed under the group that serves them and counted under the
// collection, which is how the managed-object index reports them and what the export quota
// pre-check and the frontend's stat rows expect.
func TestResourceListerFromAPIs_CountsCollectionMembersUnderTheCollection(t *testing.T) {
	const collection = "datasource.grafana.app"
	memberGVK := schema.GroupVersionKind{Group: "grafana-testdata-datasource." + collection, Version: "v0alpha1", Kind: "DataSource"}
	memberGVR := schema.GroupVersionResource{Group: memberGVK.Group, Version: "v0alpha1", Resource: "datasources"}
	member := SupportedResource{GroupKind: memberGVK.GroupKind(), Collection: collection}

	dyn := fakeDynamic(t, map[kindPair][]*unstructured.Unstructured{
		{memberGVK, memberGVR}: {
			managedObject(t, memberGVK, "ds-1", utils.ManagerKindRepo, "repo", "ds-1.json"),
			plainObject(t, memberGVK, "ds-2"),
		},
	})
	clients := NewMockResourceClients(t)
	clients.EXPECT().SupportedResources().Return([]SupportedResource{member})
	clients.EXPECT().ForKind(mock.Anything, memberGVK.GroupKind().WithVersion("")).
		Return(dyn.Resource(memberGVR).Namespace("default"), memberGVR, nil).Twice()
	factory := NewMockClientFactory(t)
	factory.EXPECT().Clients(mock.Anything, "default").Return(clients, nil).Twice()

	lister := NewAPIResourceLister(factory, []SupportedResource{
		{GroupKind: schema.GroupKind{Group: provisioningresources.CollectionPrefix + collection, Kind: "DataSource"}},
	})

	stats, err := lister.Stats(context.Background(), "default", "")
	require.NoError(t, err)
	require.Equal(t, []provisioning.ResourceCount{{Group: collection, Resource: "datasources", Count: 2}}, stats.Instance)
	require.Equal(t, []provisioning.ResourceCount{{Group: collection, Resource: "datasources", Count: 1}}, stats.Unmanaged)

	list, err := lister.List(context.Background(), "default", "repo")
	require.NoError(t, err)
	require.Equal(t, memberGVK.Group, list.Items[0].Group, "the list keeps the serving group, which is addressable")
}

type kindPair struct {
	gvk schema.GroupVersionKind
	gvr schema.GroupVersionResource
}

// fakeDynamic serves the given objects for each kind.
func fakeDynamic(t *testing.T, objects map[kindPair][]*unstructured.Unstructured) *dynamicfake.FakeDynamicClient {
	t.Helper()
	scheme := runtime.NewScheme()
	listKinds := map[schema.GroupVersionResource]string{}
	var objs []runtime.Object
	for pair, items := range objects {
		listGVK := pair.gvk
		listGVK.Kind += "List"
		scheme.AddKnownTypeWithName(listGVK, &unstructured.UnstructuredList{})
		scheme.AddKnownTypeWithName(pair.gvk, &unstructured.Unstructured{})
		listKinds[pair.gvr] = listGVK.Kind
		for _, obj := range items {
			objs = append(objs, obj)
		}
	}
	return dynamicfake.NewSimpleDynamicClientWithCustomListKinds(scheme, listKinds, objs...)
}

// apiListerClients wires a fake dynamic client per kind and the client mocks that hand them out.
func apiListerClients(t *testing.T, objects map[kindPair][]*unstructured.Unstructured) (*MockResourceClients, ClientFactory) {
	t.Helper()
	dyn := fakeDynamic(t, objects)

	clients := NewMockResourceClients(t)
	clients.EXPECT().SupportedResources().Return(configuredKinds())
	for pair := range objects {
		clients.EXPECT().ForKind(mock.Anything, pair.gvk.GroupKind().WithVersion("")).
			Return(dyn.Resource(pair.gvr).Namespace("default"), pair.gvr, nil).Once()
	}

	factory := NewMockClientFactory(t)
	factory.EXPECT().Clients(mock.Anything, "default").Return(clients, nil).Once()
	return clients, factory
}

func configuredKinds() []SupportedResource {
	return []SupportedResource{
		{GroupKind: dashboardKindGVK.GroupKind()},
		{GroupKind: playlistKindGVK.GroupKind()},
	}
}

func plainObject(t *testing.T, gvk schema.GroupVersionKind, name string) *unstructured.Unstructured {
	t.Helper()
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": gvk.GroupVersion().String(),
		"kind":       gvk.Kind,
		"metadata":   map[string]any{"name": name, "namespace": "default"},
		"spec":       map[string]any{"title": "Test data"},
	}}
}

func managedObject(t *testing.T, gvk schema.GroupVersionKind, name string, kind utils.ManagerKind, identity, path string) *unstructured.Unstructured {
	t.Helper()
	obj := plainObject(t, gvk, name)
	m, err := utils.MetaAccessor(obj)
	require.NoError(t, err)
	m.SetManagerProperties(utils.ManagerProperties{Kind: kind, Identity: identity})
	m.SetSourceProperties(utils.SourceProperties{Path: path, Checksum: "abc"})
	return obj
}
