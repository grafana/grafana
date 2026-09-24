package provisioning

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func resourceListContext(t *testing.T, role identity.RoleType) context.Context {
	t.Helper()
	return identity.WithRequester(t.Context(), &identity.StaticRequester{
		Type: authlib.TypeUser, UserUID: "reader", Namespace: "default", OrgRole: role,
	})
}

func resourceListWriteRequest() authlib.CheckRequest {
	return authlib.CheckRequest{
		Namespace: "default", Group: provisioning.GROUP,
		Resource: provisioning.RepositoryResourceInfo.GetName(), Name: "repo", Verb: utils.VerbUpdate,
	}
}

func resourceListReadRequest(item provisioning.ResourceListItem) authlib.CheckRequest {
	return authlib.CheckRequest{
		Namespace: "default", Group: item.Group, Resource: item.Resource, Name: item.Name, Verb: utils.VerbGet,
	}
}

func resourceListClients(t *testing.T, ctx context.Context, supported []resources.SupportedResource) (*resources.MockClientFactory, *resources.MockResourceClients) {
	t.Helper()
	clients := resources.NewMockResourceClients(t)
	clients.EXPECT().SupportedResources().Return(supported).Once()
	factory := resources.NewMockClientFactory(t)
	factory.EXPECT().Clients(ctx, "default").Return(clients, nil).Once()
	return factory, clients
}

func TestResourceListPermissionSelectsBackend(t *testing.T) {
	for _, role := range []identity.RoleType{identity.RoleViewer, identity.RoleAdmin} {
		for _, allowed := range []bool{true, false} {
			name := string(role) + "/search"
			if allowed {
				name = string(role) + "/list"
			}
			t.Run(name, func(t *testing.T) {
				ctx := resourceListContext(t, role)
				lister := resources.NewMockResourceLister(t)
				access := auth.NewMockAccessChecker(t)
				admin := auth.NewMockAccessChecker(t)
				factory := resources.NewMockClientFactory(t)
				item := provisioning.ResourceListItem{
					Group: "custom.grafana.app", Resource: "policies", Name: "policy", Path: "policy.json", Folder: "parent",
				}
				listed := &provisioning.ResourceList{Items: []provisioning.ResourceListItem{item}}
				if allowed {
					admin.EXPECT().Check(ctx, resourceListWriteRequest(), "").Return(nil).Once()
					lister.EXPECT().List(ctx, "default", "repo").Return(listed, nil).Once()
				} else {
					admin.EXPECT().Check(ctx, resourceListWriteRequest(), "").Return(mockForbidden()).Once()
					kind := schema.GroupKind{Group: item.Group, Kind: "Policy"}
					clients := resources.NewMockResourceClients(t)
					factory.EXPECT().Clients(ctx, "default").Return(clients, nil).Once()
					clients.EXPECT().SupportedResources().Return([]resources.SupportedResource{{GroupKind: kind}}).Once()
					gvr := schema.GroupVersionResource{Group: item.Group, Version: "v1", Resource: item.Resource}
					clients.EXPECT().ForKind(ctx, kind.WithVersion("")).Return(nil, gvr, nil).Once()
					lister.EXPECT().Search(ctx, "default", "repo", []schema.GroupResource{gvr.GroupResource()}).Return(listed, nil).Once()
					access.EXPECT().Check(ctx, resourceListReadRequest(item), item.Folder).Return(nil).Once()
				}

				actual, err := NewListConnector(lister, factory, access, admin).list(ctx, "default", "repo")
				require.NoError(t, err)
				require.Equal(t, listed, actual)
			})
		}
	}
}

func TestResourceListUsesConfiguredKindsAndStrictReadPermissions(t *testing.T) {
	ctx := resourceListContext(t, identity.RoleViewer)
	supported := []resources.SupportedResource{
		{GroupKind: resources.DashboardKind.GroupKind()},
		{GroupKind: resources.FolderKind.GroupKind()},
		{GroupKind: schema.GroupKind{Group: "custom.grafana.app", Kind: "Policy"}},
		{GroupKind: schema.GroupKind{Group: "custom.grafana.app", Kind: "Person"}},
		{GroupKind: schema.GroupKind{Group: "custom.grafana.app", Kind: "Disabled"}, Capabilities: sets.New(resources.CapabilityDisabled)},
	}
	gvrs := []schema.GroupVersionResource{
		resources.DashboardResource, resources.FolderResource,
		{Group: "custom.grafana.app", Version: "v2", Resource: "policies"},
		{Group: "custom.grafana.app", Version: "v1", Resource: "people"},
	}
	factory, clients := resourceListClients(t, ctx, supported)
	types := make([]schema.GroupResource, 0, len(gvrs))
	for i, gvr := range gvrs {
		clients.EXPECT().ForKind(ctx, supported[i].GroupKind.WithVersion("")).Return(nil, gvr, nil).Once()
		types = append(types, gvr.GroupResource())
	}
	items := []provisioning.ResourceListItem{
		{Group: resources.DashboardResource.Group, Resource: "dashboards", Name: "denied", Path: "same.json", Folder: "parent"},
		{Group: resources.DashboardResource.Group, Resource: "dashboards", Name: "direct-read", Path: "same.json", Folder: "parent"},
		{Group: resources.DashboardResource.Group, Resource: "dashboards", Name: "also-readable", Path: "same.json", Folder: "parent"},
		{Group: resources.FolderResource.Group, Resource: "folders", Name: "parent", Path: "parent/", Folder: "general"},
		{Group: "custom.grafana.app", Resource: "policies", Name: "denied-policy", Path: "denied.json"},
		{Group: "custom.grafana.app", Resource: "people", Name: "readable-person", Path: "person.json"},
	}
	lister := resources.NewMockResourceLister(t)
	lister.EXPECT().Search(ctx, "default", "repo", types).Return(&provisioning.ResourceList{Items: items}, nil).Once()
	admin := auth.NewMockAccessChecker(t)
	admin.EXPECT().Check(ctx, resourceListWriteRequest(), "").Return(mockForbidden()).Once()
	access := auth.NewMockAccessChecker(t)
	for i, item := range items {
		var err error
		if i == 0 || i == 3 || i == 4 {
			err = mockForbidden()
		}
		access.EXPECT().Check(ctx, resourceListReadRequest(item), item.Folder).Return(err).Once()
	}
	actual, err := NewListConnector(lister, factory, access, admin).list(ctx, "default", "repo")
	require.NoError(t, err)
	require.Equal(t, []provisioning.ResourceListItem{items[1], items[2], items[5]}, actual.Items)
}

func TestResourceListRejectsInvalidIdentity(t *testing.T) {
	for _, tc := range []struct {
		name      string
		caller    bool
		anonymous bool
		namespace string
	}{
		{name: "unauthenticated", namespace: "default"},
		{name: "anonymous", anonymous: true, namespace: "default"},
		{name: "other namespace", caller: true, namespace: "org-2"},
		{name: "missing namespace", caller: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx := t.Context()
			if tc.caller {
				ctx = resourceListContext(t, identity.RoleAdmin)
			}
			if tc.anonymous {
				ctx = identity.WithRequester(ctx, &identity.StaticRequester{Type: authlib.TypeAnonymous, Namespace: "default"})
			}
			connector := NewListConnector(resources.NewMockResourceLister(t), resources.NewMockClientFactory(t), auth.NewMockAccessChecker(t), auth.NewMockAccessChecker(t))
			result, err := connector.list(ctx, tc.namespace, "repo")
			require.Nil(t, result)
			if tc.caller {
				require.True(t, apierrors.IsForbidden(err))
			} else {
				require.True(t, apierrors.IsUnauthorized(err))
			}
		})
	}
}

type resourceListCheckFunc func(context.Context, authlib.AuthInfo, authlib.CheckRequest, string) (authlib.CheckResponse, error)

func (f resourceListCheckFunc) Check(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	return f(ctx, id, req, folder)
}

func TestResourceListDoesNotSearchWhenAuthorizationBackendFails(t *testing.T) {
	ctx := resourceListContext(t, identity.RoleViewer)
	failure := errors.New("authorization backend unavailable")
	inner := resourceListCheckFunc(func(_ context.Context, _ authlib.AuthInfo, req authlib.CheckRequest, _ string) (authlib.CheckResponse, error) {
		require.Equal(t, resourceListWriteRequest(), req)
		return authlib.CheckResponse{}, failure
	})
	for name, checker := range map[string]auth.AccessChecker{
		"session": auth.NewSessionAccessChecker(inner).WithFallbackRole(identity.RoleAdmin),
		"token":   auth.NewTokenAccessChecker(inner),
	} {
		t.Run(name, func(t *testing.T) {
			connector := NewListConnector(resources.NewMockResourceLister(t), resources.NewMockClientFactory(t), auth.NewMockAccessChecker(t), checker)
			result, err := connector.list(ctx, "default", "repo")
			require.Nil(t, result)
			require.ErrorIs(t, err, failure)
			require.True(t, apierrors.IsForbidden(err))
		})
	}
}

func TestResourceListNoActiveKinds(t *testing.T) {
	for _, supported := range [][]resources.SupportedResource{
		{},
		{{GroupKind: resources.DashboardKind.GroupKind(), Capabilities: sets.New(resources.CapabilityDisabled)}},
	} {
		t.Run("empty or disabled", func(t *testing.T) {
			ctx := resourceListContext(t, identity.RoleViewer)
			factory, _ := resourceListClients(t, ctx, supported)
			admin := auth.NewMockAccessChecker(t)
			admin.EXPECT().Check(ctx, resourceListWriteRequest(), "").Return(mockForbidden()).Once()
			result, err := NewListConnector(resources.NewMockResourceLister(t), factory, auth.NewMockAccessChecker(t), admin).list(ctx, "default", "repo")
			require.NoError(t, err)
			require.NotNil(t, result.Items)
			require.Empty(t, result.Items)
		})
	}
}

func TestResourceListErrorsDoNotFallBack(t *testing.T) {
	for _, stage := range []string{"permission", "unauthorized", "list", "clients", "discovery", "search", "read"} {
		t.Run(stage, func(t *testing.T) {
			ctx := resourceListContext(t, identity.RoleViewer)
			failure := errors.New("unexpected failure")
			if stage == "unauthorized" {
				failure = apierrors.NewUnauthorized("invalid identity")
			}
			lister := resources.NewMockResourceLister(t)
			factory := resources.NewMockClientFactory(t)
			admin := auth.NewMockAccessChecker(t)
			access := auth.NewMockAccessChecker(t)
			switch stage {
			case "permission", "unauthorized":
				admin.EXPECT().Check(ctx, resourceListWriteRequest(), "").Return(failure).Once()
			case "list":
				admin.EXPECT().Check(ctx, resourceListWriteRequest(), "").Return(nil).Once()
				lister.EXPECT().List(ctx, "default", "repo").Return(nil, failure).Once()
			default:
				admin.EXPECT().Check(ctx, resourceListWriteRequest(), "").Return(mockForbidden()).Once()
				if stage == "clients" {
					factory.EXPECT().Clients(ctx, "default").Return(nil, failure).Once()
					break
				}
				clients := resources.NewMockResourceClients(t)
				factory.EXPECT().Clients(ctx, "default").Return(clients, nil).Once()
				clients.EXPECT().SupportedResources().Return([]resources.SupportedResource{{GroupKind: resources.DashboardKind.GroupKind()}}).Once()
				if stage == "discovery" {
					clients.EXPECT().ForKind(ctx, resources.DashboardKind.GroupKind().WithVersion("")).Return(nil, schema.GroupVersionResource{}, failure).Once()
					break
				}
				clients.EXPECT().ForKind(ctx, resources.DashboardKind.GroupKind().WithVersion("")).Return(nil, resources.DashboardResource, nil).Once()
				if stage == "search" {
					lister.EXPECT().Search(ctx, "default", "repo", mock.Anything).Return(nil, failure).Once()
					break
				}
				item := provisioning.ResourceListItem{Group: resources.DashboardResource.Group, Resource: "dashboards", Name: "one", Path: "one.json"}
				lister.EXPECT().Search(ctx, "default", "repo", mock.Anything).Return(&provisioning.ResourceList{Items: []provisioning.ResourceListItem{item}}, nil).Once()
				access.EXPECT().Check(ctx, resourceListReadRequest(item), "").Return(failure).Once()
			}
			result, err := NewListConnector(lister, factory, access, admin).list(ctx, "default", "repo")
			require.Nil(t, result)
			require.ErrorIs(t, err, failure)
		})
	}
}

func TestResourceListConnectorUsesRequestNamespace(t *testing.T) {
	ctx := request.WithNamespace(resourceListContext(t, identity.RoleViewer), "default")
	admin := auth.NewMockAccessChecker(t)
	admin.EXPECT().Check(ctx, resourceListWriteRequest(), "").Return(nil).Once()
	lister := resources.NewMockResourceLister(t)
	expected := &provisioning.ResourceList{Items: []provisioning.ResourceListItem{{Name: "one"}}}
	lister.EXPECT().List(ctx, "default", "repo").Return(expected, nil).Once()
	connector := NewListConnector(lister, resources.NewMockClientFactory(t), auth.NewMockAccessChecker(t), admin)
	responder := &mockResponder{}
	handler, err := connector.Connect(ctx, "repo", nil, responder)
	require.NoError(t, err)
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))
	require.NoError(t, responder.err)
	require.Equal(t, http.StatusOK, responder.code)
	require.Equal(t, expected, responder.obj)
}

type resourceListSearchStore struct {
	resources.ResourceStore
	search func(context.Context, *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error)
}

func (s resourceListSearchStore) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	return s.search(ctx, req)
}

func TestResourceListSearchContinuesAfterDeniedPage(t *testing.T) {
	kind := schema.GroupKind{Group: "custom.grafana.app", Kind: "Policy"}
	gvr := kind.WithVersion("v1").GroupVersion().WithResource("policies")
	items := []provisioning.ResourceListItem{
		{Group: gvr.Group, Resource: gvr.Resource, Name: "denied-a", Path: "a.json", Folder: "denied-folder"},
		{Group: gvr.Group, Resource: gvr.Resource, Name: "denied-b", Path: "b.json", Folder: "denied-folder"},
		{Group: gvr.Group, Resource: gvr.Resource, Name: "readable", Path: "c.json", Folder: "readable-folder"},
	}
	pages := [][]provisioning.ResourceListItem{items[:2], items[2:], nil}
	offsets := []int64{0, 2, 3}
	cursors := [][]string{nil, {"denied-b", "doc-denied-b"}, {"readable", "doc-readable"}}
	for _, format := range []resourcepb.ResourceSearchRequest_ResultFormat{
		resourcepb.ResourceSearchRequest_FIELD_VALUES,
		resourcepb.ResourceSearchRequest_RESOURCE_TABLE,
		resourcepb.ResourceSearchRequest_UNSPECIFIED,
	} {
		for _, withCursor := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/cursor=%t", format, withCursor), func(t *testing.T) {
				ctx := resourceListContext(t, identity.RoleViewer)
				factory, clients := resourceListClients(t, ctx, []resources.SupportedResource{{GroupKind: kind}})
				clients.EXPECT().ForKind(ctx, kind.WithVersion("")).Return(nil, gvr, nil).Once()
				admin := auth.NewMockAccessChecker(t)
				admin.EXPECT().Check(ctx, resourceListWriteRequest(), "").Return(mockForbidden()).Once()
				access := auth.NewMockAccessChecker(t)
				access.EXPECT().Check(ctx, resourceListReadRequest(items[0]), items[0].Folder).Return(mockForbidden()).Once()
				access.EXPECT().Check(ctx, resourceListReadRequest(items[1]), items[1].Folder).Return(mockForbidden()).Once()
				access.EXPECT().Check(ctx, resourceListReadRequest(items[2]), items[2].Folder).Return(nil).Once()
				count := 0
				store := resourceListSearchStore{search: func(actualCtx context.Context, req *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
					require.Same(t, ctx, actualCtx)
					require.Equal(t, resourcepb.ResourceSearchRequest_FIELD_VALUES, req.ResultFormat)
					require.Less(t, count, len(pages))
					if withCursor {
						require.Zero(t, req.Offset)
						require.Equal(t, cursors[count], req.SearchAfter)
					} else {
						require.Equal(t, offsets[count], req.Offset)
						require.Empty(t, req.SearchAfter)
					}
					page := pages[count]
					count++
					response := &resourcepb.ResourceSearchResponse{ResultFormat: format, TotalHits: 10}
					if format == resourcepb.ResourceSearchRequest_FIELD_VALUES {
						response.Fields = []*resourcepb.ResourceSearchField{
							{Name: resource.SEARCH_FIELD_SOURCE_PATH, Type: resourcepb.ResourceSearchField_STRING},
							{Name: resource.SEARCH_FIELD_FOLDER, Type: resourcepb.ResourceSearchField_STRING},
						}
						for _, item := range page {
							row := &resourcepb.ResourceSearchRow{
								Key: &resourcepb.ResourceKey{Namespace: "default", Group: item.Group, Resource: item.Resource, Name: item.Name},
								Values: []*resourcepb.ResourceSearchValue{
									{FieldIndex: 0, StringValues: []string{item.Path}},
									{FieldIndex: 1, StringValues: []string{item.Folder}},
								},
							}
							if withCursor {
								row.SortFields = []string{row.Key.Name, "doc-" + row.Key.Name}
							}
							response.Rows = append(response.Rows, row)
						}
						return response, nil
					}
					columns := make([]*resourcepb.ResourceTableColumnDefinition, 0, len(req.Fields))
					for _, field := range req.Fields {
						columns = append(columns, resource.StandardSearchFields().Field(field))
					}
					table, err := resource.NewTableBuilder(columns)
					require.NoError(t, err)
					for _, item := range page {
						err := table.AddRow(&resourcepb.ResourceKey{
							Namespace: "default", Group: item.Group, Resource: item.Resource, Name: item.Name,
						}, 1, map[string]any{
							resource.SEARCH_FIELD_SOURCE_PATH: item.Path,
							resource.SEARCH_FIELD_FOLDER:      item.Folder,
						})
						require.NoError(t, err)
					}
					if withCursor {
						for _, row := range table.Rows {
							row.SortFields = []string{row.Key.Name, "doc-" + row.Key.Name}
						}
					}
					response.Results = &table.ResourceTable
					return response, nil
				}}

				result, err := NewListConnector(resources.NewResourceLister(store), factory, access, admin).list(ctx, "default", "repo")
				require.NoError(t, err)
				require.Equal(t, len(pages), count)
				require.Equal(t, []provisioning.ResourceListItem{items[2]}, result.Items)
			})
		}
	}
}
