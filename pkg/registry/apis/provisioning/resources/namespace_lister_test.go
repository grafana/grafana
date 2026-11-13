package resources

import (
	"context"
	"slices"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apimachinery/pkg/util/sets"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	provisioningresources "github.com/grafana/grafana/apps/provisioning/pkg/resources"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var (
	dashboardGVR = schema.GroupVersionResource{Group: "dashboard.grafana.app", Version: "v1beta1", Resource: "dashboards"}
	folderGVR    = schema.GroupVersionResource{Group: "folder.grafana.app", Version: "v1beta1", Resource: "folders"}
)

// searchRow builds a FIELD_VALUES row over the fields the namespace lister requests.
type searchRow struct {
	name        string
	title       string
	folder      string
	managerKind string
	managerID   string
	path        string
	hash        string
	time        int64
}

func searchResponse(fields []string, rows ...searchRow) *resourcepb.ResourceSearchResponse {
	declarations := make([]*resourcepb.ResourceSearchField, 0, len(fields))
	for _, name := range fields {
		field := &resourcepb.ResourceSearchField{Name: name, Type: resourcepb.ResourceSearchField_STRING}
		if name == resource.SEARCH_FIELD_SOURCE_TIME {
			field.Type = resourcepb.ResourceSearchField_INT64
		}
		declarations = append(declarations, field)
	}

	rsp := &resourcepb.ResourceSearchResponse{
		Fields:       declarations,
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
	}
	for _, row := range rows {
		values := make([]*resourcepb.ResourceSearchValue, 0, len(fields))
		for i, name := range fields {
			value := &resourcepb.ResourceSearchValue{FieldIndex: uint32(i)}
			switch name {
			case resource.SEARCH_FIELD_TITLE:
				value.StringValues = []string{row.title}
			case resource.SEARCH_FIELD_FOLDER:
				value.StringValues = []string{row.folder}
			case resource.SEARCH_FIELD_MANAGER_KIND:
				value.StringValues = []string{row.managerKind}
			case resource.SEARCH_FIELD_MANAGER_ID:
				value.StringValues = []string{row.managerID}
			case resource.SEARCH_FIELD_SOURCE_PATH:
				value.StringValues = []string{row.path}
			case resource.SEARCH_FIELD_SOURCE_CHECKSUM:
				value.StringValues = []string{row.hash}
			case resource.SEARCH_FIELD_SOURCE_TIME:
				value.Int64Values = []int64{row.time}
			}
			values = append(values, value)
		}
		rsp.Rows = append(rsp.Rows, &resourcepb.ResourceSearchRow{
			Key:        &resourcepb.ResourceKey{Name: row.name},
			Values:     values,
			SortFields: []string{row.name},
		})
	}
	return rsp
}

// namespaceListerFor wires a lister whose configured kinds resolve to the given GVRs.
func namespaceListerFor(t *testing.T, store ResourceStore, gvrs ...schema.GroupVersionResource) *NamespaceListerFromSearch {
	t.Helper()
	clients := NewMockResourceClients(t)
	supported := make([]SupportedResource, 0, len(gvrs))
	for _, gvr := range gvrs {
		gk := schema.GroupKind{Group: gvr.Group, Kind: gvr.Resource}
		supported = append(supported, SupportedResource{GroupKind: gk})
		clients.EXPECT().ForKind(mock.Anything, gk.WithVersion("")).Return(nil, gvr, nil).Once()
	}
	clients.EXPECT().SupportedResources().Return(supported)

	factory := NewMockClientFactory(t)
	factory.EXPECT().Clients(mock.Anything, "default").Return(clients, nil).Once()
	return NewNamespaceLister(store, factory, supported)
}

func TestNamespaceLister_ManagerFilters(t *testing.T) {
	managed, unmanaged := true, false
	for _, tc := range []struct {
		name    string
		opts    NamespaceListOptions
		want    []*resourcepb.Requirement
		wantErr string
	}{
		{
			name: "no manager selection",
			opts: NamespaceListOptions{},
			want: nil,
		},
		{
			// Only the low-cardinality kind: a whole-value regex on manager.id would
			// enumerate one dictionary term per manager. Identity is checked on the rows.
			name: "unmanaged filters the manager kind in the index, not the identity",
			opts: NamespaceListOptions{Managed: &unmanaged},
			want: []*resourcepb.Requirement{
				{Key: resource.SEARCH_FIELD_MANAGER_KIND, Operator: string(resource.OperatorRegex), Values: []string{""}},
			},
		},
		{
			name: "managed is any value the field carries",
			opts: NamespaceListOptions{Managed: &managed},
			want: []*resourcepb.Requirement{{
				Key:      resource.SEARCH_FIELD_MANAGER_KIND,
				Operator: string(resource.OperatorRegex),
				Values:   []string{".+"},
			}},
		},
		{
			name: "one repository",
			opts: NamespaceListOptions{ManagerKind: "repo", ManagerID: "my-repo"},
			want: []*resourcepb.Requirement{
				{Key: resource.SEARCH_FIELD_MANAGER_KIND, Operator: string(selection.Equals), Values: []string{"repo"}},
				{Key: resource.SEARCH_FIELD_MANAGER_ID, Operator: string(selection.Equals), Values: []string{"my-repo"}},
			},
		},
		{
			name: "a manager kind already selects managed rows",
			opts: NamespaceListOptions{ManagerKind: "repo", Managed: &managed},
			want: []*resourcepb.Requirement{
				{Key: resource.SEARCH_FIELD_MANAGER_KIND, Operator: string(selection.Equals), Values: []string{"repo"}},
			},
		},
		{
			name:    "a manager filter contradicts unmanaged",
			opts:    NamespaceListOptions{ManagerID: "my-repo", Managed: &unmanaged},
			wantErr: "managed=false cannot be combined with a manager filter",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := managerFilters(tc.opts)
			if tc.wantErr != "" {
				require.EqualError(t, err, tc.wantErr)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
		})
	}
}

func TestNamespaceLister_ListsEveryKindAndReportsItsManager(t *testing.T) {
	store := resource.NewMockResourceClient(t)
	narrow := []string{
		resource.SEARCH_FIELD_TITLE,
		resource.SEARCH_FIELD_FOLDER,
		resource.SEARCH_FIELD_MANAGER_KIND,
		resource.SEARCH_FIELD_MANAGER_ID,
	}

	store.EXPECT().Search(mock.Anything, mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
		return req.Options.Key.Resource == "dashboards"
	})).Return(searchResponse(narrow,
		searchRow{name: "db-1", title: "Dashboard 1", folder: "f-1", managerKind: "repo", managerID: "my-repo"},
		searchRow{name: "db-2", title: "Dashboard 2"},
	), nil).Once()
	store.EXPECT().Search(mock.Anything, mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
		return req.Options.Key.Resource == "folders"
	})).Return(searchResponse(narrow,
		searchRow{name: "f-1", title: "Folder 1"},
	), nil).Once()

	lister := namespaceListerFor(t, store, dashboardGVR, folderGVR)
	got, err := lister.ListNamespace(context.Background(), "default", NamespaceListOptions{})
	require.NoError(t, err)
	require.Empty(t, got.Continue)
	require.Equal(t, []provisioning.ResourceListItem{
		{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "db-1", Title: "Dashboard 1", Folder: "f-1",
			Manager: &provisioning.ResourceManager{Kind: utils.ManagerKindRepo, Identity: "my-repo"}},
		{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "db-2", Title: "Dashboard 2"},
		{Group: "folder.grafana.app", Resource: "folders", Name: "f-1", Title: "Folder 1"},
	}, got.Items, "kinds are listed in a stable order and an unmanaged row carries no manager")
}

func TestNamespaceLister_ProjectsOptionalFieldsOnly(t *testing.T) {
	store := resource.NewMockResourceClient(t)
	fields := []string{
		resource.SEARCH_FIELD_TITLE,
		resource.SEARCH_FIELD_FOLDER,
		resource.SEARCH_FIELD_MANAGER_KIND,
		resource.SEARCH_FIELD_MANAGER_ID,
		resource.SEARCH_FIELD_SOURCE_PATH,
		resource.SEARCH_FIELD_SOURCE_CHECKSUM,
	}
	store.EXPECT().Search(mock.Anything, mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
		return slices.Equal(req.Fields, fields)
	})).Return(searchResponse(fields,
		searchRow{name: "db-1", managerKind: "repo", managerID: "my-repo", path: "db-1.json", hash: "abc"},
	), nil).Once()

	lister := namespaceListerFor(t, store, dashboardGVR)
	got, err := lister.ListNamespace(context.Background(), "default", NamespaceListOptions{
		Fields: sets.New(FieldPath, FieldHash),
	})
	require.NoError(t, err)
	require.Equal(t, []provisioning.ResourceListItem{
		{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "db-1", Path: "db-1.json", Hash: "abc",
			Manager: &provisioning.ResourceManager{Kind: utils.ManagerKindRepo, Identity: "my-repo"}},
	}, got.Items)
}

// The source sub-document is indexed independently of the manager one, so a row that kept its
// source annotations after losing its manager still carries a path in the index.
func TestNamespaceLister_WithholdsSourceMetadataFromAnUnmanagedRow(t *testing.T) {
	fields := []string{
		resource.SEARCH_FIELD_TITLE,
		resource.SEARCH_FIELD_FOLDER,
		resource.SEARCH_FIELD_MANAGER_KIND,
		resource.SEARCH_FIELD_MANAGER_ID,
		resource.SEARCH_FIELD_SOURCE_PATH,
		resource.SEARCH_FIELD_SOURCE_CHECKSUM,
		resource.SEARCH_FIELD_SOURCE_TIME,
	}
	store := resource.NewMockResourceClient(t)
	store.EXPECT().Search(mock.Anything, mock.Anything).Return(searchResponse(fields,
		searchRow{name: "db-1", path: "db-1.json", hash: "abc", time: 12345},
	), nil).Once()

	lister := namespaceListerFor(t, store, dashboardGVR)
	got, err := lister.ListNamespace(context.Background(), "default", NamespaceListOptions{
		Fields: sets.New(FieldPath, FieldHash, FieldTime),
	})
	require.NoError(t, err)
	require.Equal(t, []provisioning.ResourceListItem{
		{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "db-1"},
	}, got.Items, "path, hash and time are properties only a managed resource has")
}

// GetManagerProperties reads an identity alone as managed, so the row must keep its manager here
// rather than be reported as something nothing owns.
func TestNamespaceLister_ReportsAManagerIdentityWithoutAKind(t *testing.T) {
	store := resource.NewMockResourceClient(t)
	store.EXPECT().Search(mock.Anything, mock.Anything).Return(searchResponse(responseFields(nil),
		searchRow{name: "db-1", managerID: "my-repo"},
	), nil).Once()

	lister := namespaceListerFor(t, store, dashboardGVR)
	got, err := lister.ListNamespace(context.Background(), "default", NamespaceListOptions{})
	require.NoError(t, err)
	require.Equal(t, []provisioning.ResourceListItem{
		{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "db-1",
			Manager: &provisioning.ResourceManager{Identity: "my-repo"}},
	}, got.Items)
}

// The index filter for managed=false can only require an empty manager kind, so the identity has
// to be excluded from the rows it returns; otherwise a row managed by identity alone is offered
// as something nothing owns.
func TestNamespaceLister_DropsAnIdentityBearingRowFromUnmanaged(t *testing.T) {
	unmanaged := false
	store := resource.NewMockResourceClient(t)
	store.EXPECT().Search(mock.Anything, mock.Anything).Return(searchResponse(responseFields(nil),
		searchRow{name: "db-1"},
		searchRow{name: "db-2", managerID: "my-repo"},
	), nil).Once()

	lister := namespaceListerFor(t, store, dashboardGVR)
	got, err := lister.ListNamespace(context.Background(), "default", NamespaceListOptions{Managed: &unmanaged})
	require.NoError(t, err)
	require.Equal(t, []provisioning.ResourceListItem{
		{Group: "dashboard.grafana.app", Resource: "dashboards", Name: "db-1"},
	}, got.Items)
}

// Rows the managed filter discards cost a search each and buy no progress, so a long enough run
// of them would spend the route's whole deadline in one request.
func TestNamespaceLister_AnswersShortRatherThanScanALongDiscardedRun(t *testing.T) {
	unmanaged := false
	store := resource.NewMockResourceClient(t)
	// Every search returns a full page of rows the filter drops, so the kind never looks
	// exhausted and the page never fills.
	store.EXPECT().Search(mock.Anything, mock.Anything).RunAndReturn(
		func(_ context.Context, req *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
			return searchResponse(responseFields(nil), searchRow{name: "db-1", managerID: "my-repo"}), nil
		}).Times(maxFruitlessSearches)

	lister := namespaceListerFor(t, store, dashboardGVR)
	got, err := lister.ListNamespace(context.Background(), "default", NamespaceListOptions{
		Managed: &unmanaged,
		Limit:   1,
	})
	require.NoError(t, err)
	require.Empty(t, got.Items, "every row was discarded by the filter")
	require.NotEmpty(t, got.Continue, "a short page must still say where to resume")

	cursor, err := decodeCursor(got.Continue)
	require.NoError(t, err)
	require.Equal(t, "dashboard.grafana.app", cursor.Group)
	require.Equal(t, []string{"db-1"}, cursor.After, "resumes at the last row examined")
}

// A truncated inventory must not be presented as a complete one.
func TestNamespaceLister_RefusesAContinueTokenForAKindNoLongerListed(t *testing.T) {
	token, err := encodeCursor(namespaceListCursor{
		Group: "playlist.grafana.app", Resource: "playlists", After: []string{"pl-1"},
	})
	require.NoError(t, err)

	lister := namespaceListerFor(t, resource.NewMockResourceClient(t), dashboardGVR)
	_, err = lister.ListNamespace(context.Background(), "default", NamespaceListOptions{Continue: token})
	require.Error(t, err)
	require.True(t, apierrors.IsBadRequest(err), "expected a bad request, got: %v", err)
	require.Contains(t, err.Error(), "playlist.grafana.app/playlists")
}

// A server answering in another format would make every kind look empty.
func TestNamespaceLister_RefusesANonFieldValueSearchResponse(t *testing.T) {
	rsp := searchResponse(responseFields(nil), searchRow{name: "db-1"})
	rsp.ResultFormat = resourcepb.ResourceSearchRequest_RESOURCE_TABLE

	store := resource.NewMockResourceClient(t)
	store.EXPECT().Search(mock.Anything, mock.Anything).Return(rsp, nil).Once()

	lister := namespaceListerFor(t, store, dashboardGVR)
	_, err := lister.ListNamespace(context.Background(), "default", NamespaceListOptions{})
	require.Error(t, err)
	require.Contains(t, err.Error(), "expected field values")
}

// The documented order is group then resource, which GroupResource.String() does not give.
func TestNamespaceLister_OrdersKindsByGroupThenResource(t *testing.T) {
	libraryPanelGVR := schema.GroupVersionResource{Group: "dashboard.grafana.app", Version: "v1", Resource: "librarypanels"}
	store := resource.NewMockResourceClient(t)
	var searched []string
	store.EXPECT().Search(mock.Anything, mock.Anything).RunAndReturn(
		func(_ context.Context, req *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
			searched = append(searched, req.Options.Key.Group+"/"+req.Options.Key.Resource)
			return searchResponse(responseFields(nil)), nil
		}).Times(3)

	lister := namespaceListerFor(t, store, folderGVR, libraryPanelGVR, dashboardGVR)
	_, err := lister.ListNamespace(context.Background(), "default", NamespaceListOptions{})
	require.NoError(t, err)
	require.Equal(t, []string{
		"dashboard.grafana.app/dashboards",
		"dashboard.grafana.app/librarypanels",
		"folder.grafana.app/folders",
	}, searched)
}

func TestNamespaceLister_ResumesInsideTheKindItStoppedIn(t *testing.T) {
	store := resource.NewMockResourceClient(t)
	narrow := responseFields(nil)
	store.EXPECT().Search(mock.Anything, mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
		return req.Options.Key.Resource == "dashboards" && req.Limit == 1 && len(req.SearchAfter) == 0
	})).Return(searchResponse(narrow, searchRow{name: "db-1"}), nil).Once()

	lister := namespaceListerFor(t, store, dashboardGVR, folderGVR)
	first, err := lister.ListNamespace(context.Background(), "default", NamespaceListOptions{Limit: 1})
	require.NoError(t, err)
	require.Len(t, first.Items, 1)
	require.NotEmpty(t, first.Continue)

	cursor, err := decodeCursor(first.Continue)
	require.NoError(t, err)
	require.Equal(t, namespaceListCursor{Group: "dashboard.grafana.app", Resource: "dashboards", After: []string{"db-1"}}, cursor)

	store2 := resource.NewMockResourceClient(t)
	store2.EXPECT().Search(mock.Anything, mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
		return req.Options.Key.Resource == "dashboards" && slices.Equal(req.SearchAfter, []string{"db-1"})
	})).Return(searchResponse(narrow), nil).Once()
	store2.EXPECT().Search(mock.Anything, mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
		return req.Options.Key.Resource == "folders" && len(req.SearchAfter) == 0
	})).Return(searchResponse(narrow, searchRow{name: "f-1"}), nil).Once()

	lister2 := namespaceListerFor(t, store2, dashboardGVR, folderGVR)
	second, err := lister2.ListNamespace(context.Background(), "default", NamespaceListOptions{Continue: first.Continue})
	require.NoError(t, err)
	require.Equal(t, []provisioning.ResourceListItem{
		{Group: "folder.grafana.app", Resource: "folders", Name: "f-1"},
	}, second.Items, "an exhausted kind carries on into the next one")
	require.Empty(t, second.Continue)
}

func TestNamespaceLister_RejectsAnInvalidContinueToken(t *testing.T) {
	lister := NewNamespaceLister(resource.NewMockResourceClient(t), NewMockClientFactory(t), nil)
	_, err := lister.ListNamespace(context.Background(), "default", NamespaceListOptions{Continue: "not-a-token"})
	require.EqualError(t, err, "invalid continue token")
	require.True(t, apierrors.IsBadRequest(err), "a malformed token is a bad request")
}

func TestNamespaceLister_FiltersToOneKind(t *testing.T) {
	store := resource.NewMockResourceClient(t)
	store.EXPECT().Search(mock.Anything, mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
		return req.Options.Key.Group == "folder.grafana.app" && req.Options.Key.Resource == "folders"
	})).Return(searchResponse(responseFields(nil), searchRow{name: "f-1"}), nil).Once()

	lister := namespaceListerFor(t, store, dashboardGVR, folderGVR)
	got, err := lister.ListNamespace(context.Background(), "default", NamespaceListOptions{
		Group:    "folder.grafana.app",
		Resource: "folders",
	})
	require.NoError(t, err)
	require.Len(t, got.Items, 1)
}

// A collection member is keyed in the index by the group its objects are stored under, which
// every member shares: searching that key cannot tell a configured member from a sibling the
// configuration excludes, so this endpoint does not list members at all and refuses a filter
// naming the storage group rather than answering it with the siblings.
func TestNamespaceLister_DoesNotListCollectionMembers(t *testing.T) {
	const collection = "datasource.grafana.app"
	memberGK := schema.GroupKind{Group: "grafana-testdata-datasource." + collection, Kind: "DataSource"}

	newLister := func(t *testing.T) *NamespaceListerFromSearch {
		clients := NewMockResourceClients(t)
		clients.EXPECT().SupportedResources().Return([]SupportedResource{
			{GroupKind: memberGK, Collection: collection},
			{GroupKind: schema.GroupKind{Group: dashboardGVR.Group, Kind: "Dashboard"}},
		})
		clients.EXPECT().ForKind(mock.Anything, schema.GroupKind{Group: dashboardGVR.Group, Kind: "Dashboard"}.WithVersion("")).
			Return(nil, dashboardGVR, nil).Once()
		factory := NewMockClientFactory(t)
		factory.EXPECT().Clients(mock.Anything, "default").Return(clients, nil).Once()
		return NewNamespaceLister(resource.NewMockResourceClient(t), factory, []SupportedResource{
			{GroupKind: schema.GroupKind{Group: provisioningresources.CollectionPrefix + collection, Kind: "DataSource"}},
		})
	}

	t.Run("a filter naming the storage group is refused", func(t *testing.T) {
		_, err := newLister(t).ListNamespace(context.Background(), "default", NamespaceListOptions{
			Group:    collection,
			Resource: "datasources",
		})
		require.Error(t, err)
		require.True(t, apierrors.IsBadRequest(err), "expected a bad request, got: %v", err)
	})

	t.Run("a filter naming the serving group is refused", func(t *testing.T) {
		_, err := newLister(t).ListNamespace(context.Background(), "default", NamespaceListOptions{
			Group:    memberGK.Group,
			Resource: "datasources",
		})
		require.Error(t, err)
		require.True(t, apierrors.IsBadRequest(err), "expected a bad request, got: %v", err)
	})
}

// A disabled kind may name an API the instance never installs. Resolving it failed discovery and
// with it the whole request, including a request filtered to a kind that is served.
func TestNamespaceLister_IgnoresDisabledKinds(t *testing.T) {
	store := resource.NewMockResourceClient(t)
	store.EXPECT().Search(mock.Anything, mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
		return req.Options.Key.Group == dashboardGVR.Group
	})).Return(searchResponse(responseFields(nil), searchRow{name: "db-1"}), nil).Once()

	dashboardGK := schema.GroupKind{Group: dashboardGVR.Group, Kind: "Dashboard"}
	clients := NewMockResourceClients(t)
	clients.EXPECT().SupportedResources().Return([]SupportedResource{{GroupKind: dashboardGK}})
	clients.EXPECT().ForKind(mock.Anything, dashboardGK.WithVersion("")).Return(nil, dashboardGVR, nil).Once()
	factory := NewMockClientFactory(t)
	factory.EXPECT().Clients(mock.Anything, "default").Return(clients, nil).Once()

	// Configured but absent from the served set, which is what a disabled declaration looks
	// like here; no ForKind is set up for it, so resolving it would fail the mock.
	lister := NewNamespaceLister(store, factory, []SupportedResource{
		{GroupKind: dashboardGK},
		{GroupKind: schema.GroupKind{Group: "not-installed.grafana.app", Kind: "Widget"}},
	})
	got, err := lister.ListNamespace(context.Background(), "default", NamespaceListOptions{})
	require.NoError(t, err)
	require.Equal(t, []provisioning.ResourceListItem{
		{Group: dashboardGVR.Group, Resource: dashboardGVR.Resource, Name: "db-1"},
	}, got.Items)
}

// The endpoint lists the configured kinds and nothing else, so a filter naming a kind
// provisioning does not serve is a bad request, not an empty namespace.
func TestNamespaceLister_RefusesAnUnregisteredKind(t *testing.T) {
	for _, tc := range []struct {
		name     string
		group    string
		resource string
	}{
		{name: "a group nothing configures", group: "secret.grafana.app", resource: "securevalues"},
		{name: "a resource the configured group does not serve", group: "dashboard.grafana.app", resource: "librarypanels"},
		{name: "a group alone", group: "playlist.grafana.app"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			lister := namespaceListerFor(t, resource.NewMockResourceClient(t), dashboardGVR, folderGVR)
			_, err := lister.ListNamespace(context.Background(), "default", NamespaceListOptions{
				Group:    tc.group,
				Resource: tc.resource,
			})
			require.Error(t, err)
			require.True(t, apierrors.IsBadRequest(err), "expected a bad request, got: %v", err)
			require.Contains(t, err.Error(), "dashboards.dashboard.grafana.app", "the error names what is listed")
		})
	}
}

func TestNamespaceLister_ListErrors(t *testing.T) {
	for _, tc := range resourceErrorCases(t) {
		t.Run(tc.name, func(t *testing.T) {
			store := resource.NewMockResourceClient(t)
			store.EXPECT().Search(mock.Anything, mock.Anything).Return(nil, tc.err).Once()
			lister := namespaceListerFor(t, store, dashboardGVR)
			got, err := lister.ListNamespace(context.Background(), "default", NamespaceListOptions{})
			require.Nil(t, got)
			tc.assertError(t, err)
		})
	}
}

func TestNamespaceLister_RequiresANamespace(t *testing.T) {
	lister := NewNamespaceLister(resource.NewMockResourceClient(t), NewMockClientFactory(t), nil)
	_, err := lister.ListNamespace(context.Background(), "", NamespaceListOptions{})
	require.EqualError(t, err, "namespace is required")
}
