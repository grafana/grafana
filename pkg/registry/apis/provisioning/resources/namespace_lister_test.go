package resources

import (
	"context"
	"slices"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
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

	rsp := &resourcepb.ResourceSearchResponse{Fields: declarations}
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
			name: "unmanaged is the empty-value regex, which also matches a missing field",
			opts: NamespaceListOptions{Managed: &unmanaged},
			want: []*resourcepb.Requirement{{
				Key:      resource.SEARCH_FIELD_MANAGER_KIND,
				Operator: string(resource.OperatorRegex),
				Values:   []string{""},
			}},
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

func TestNamespaceLister_StopsWhenTheResumedKindIsGone(t *testing.T) {
	token, err := encodeCursor(namespaceListCursor{Group: "playlist.grafana.app", Resource: "playlists"})
	require.NoError(t, err)

	lister := namespaceListerFor(t, resource.NewMockResourceClient(t), dashboardGVR)
	got, err := lister.ListNamespace(context.Background(), "default", NamespaceListOptions{Continue: token})
	require.NoError(t, err)
	require.Empty(t, got.Items)
	require.Empty(t, got.Continue)
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

// A collection's members are indexed under the group their objects are stored in, which is the
// key stats counts them under too.
func TestNamespaceLister_KeysACollectionByItsStorageGroup(t *testing.T) {
	const collection = "datasource.grafana.app"
	memberGVR := schema.GroupVersionResource{Group: "grafana-testdata-datasource." + collection, Version: "v0alpha1", Resource: "datasources"}
	memberGK := schema.GroupKind{Group: memberGVR.Group, Kind: "DataSource"}

	store := resource.NewMockResourceClient(t)
	store.EXPECT().Search(mock.Anything, mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
		return req.Options.Key.Group == collection && req.Options.Key.Resource == "datasources"
	})).Return(searchResponse(responseFields(nil), searchRow{name: "ds-1"}), nil).Once()

	clients := NewMockResourceClients(t)
	clients.EXPECT().SupportedResources().Return([]SupportedResource{{GroupKind: memberGK, Collection: collection}})
	clients.EXPECT().ForKind(mock.Anything, memberGK.WithVersion("")).Return(nil, memberGVR, nil).Once()
	factory := NewMockClientFactory(t)
	factory.EXPECT().Clients(mock.Anything, "default").Return(clients, nil).Once()

	lister := NewNamespaceLister(store, factory, []SupportedResource{
		{GroupKind: schema.GroupKind{Group: provisioningresources.CollectionPrefix + collection, Kind: "DataSource"}},
	})
	got, err := lister.ListNamespace(context.Background(), "default", NamespaceListOptions{})
	require.NoError(t, err)
	require.Equal(t, []provisioning.ResourceListItem{
		{Group: collection, Resource: "datasources", Name: "ds-1"},
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
