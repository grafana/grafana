package service

import (
	"context"
	"net/http"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	searchmodel "github.com/grafana/grafana/pkg/storage/unified/search/model"
)

type namespaceTestServer struct {
	searchmodel.SearchServer
	calls int
}

func (s *namespaceTestServer) ListManagedObjects(context.Context, *resourcepb.ListManagedObjectsRequest) (*resourcepb.ListManagedObjectsResponse, error) {
	s.calls++
	return &resourcepb.ListManagedObjectsResponse{}, nil
}
func (s *namespaceTestServer) CountManagedObjects(context.Context, *resourcepb.CountManagedObjectsRequest) (*resourcepb.CountManagedObjectsResponse, error) {
	s.calls++
	return &resourcepb.CountManagedObjectsResponse{}, nil
}
func (s *namespaceTestServer) RebuildIndexes(context.Context, *resourcepb.RebuildIndexesRequest) (*resourcepb.RebuildIndexesResponse, error) {
	s.calls++
	return &resourcepb.RebuildIndexesResponse{}, nil
}

func TestEmbeddedSearchNamespaceChecks(t *testing.T) {
	for _, rpc := range []struct {
		name   string
		invoke func(context.Context, searchmodel.SearchServer, string) *resourcepb.ErrorResult
	}{
		{"list", func(ctx context.Context, s searchmodel.SearchServer, ns string) *resourcepb.ErrorResult {
			r, _ := s.ListManagedObjects(ctx, &resourcepb.ListManagedObjectsRequest{Namespace: ns})
			return r.Error
		}},
		{"count", func(ctx context.Context, s searchmodel.SearchServer, ns string) *resourcepb.ErrorResult {
			r, _ := s.CountManagedObjects(ctx, &resourcepb.CountManagedObjectsRequest{Namespace: ns})
			return r.Error
		}},
		{"rebuild", func(ctx context.Context, s searchmodel.SearchServer, ns string) *resourcepb.ErrorResult {
			r, _ := s.RebuildIndexes(ctx, &resourcepb.RebuildIndexesRequest{Namespace: ns})
			return r.Error
		}},
	} {
		t.Run(rpc.name, func(t *testing.T) {
			for _, scenario := range []struct {
				name, userNamespace, requestNamespace string
				code                                  int32
			}{
				{"missing user", "", "org-1", http.StatusUnauthorized},
				{"different namespace", "org-1", "org-2", http.StatusForbidden},
				{"same namespace", "org-1", "org-1", 0},
				{"wildcard", "*", "org-2", 0},
			} {
				t.Run(scenario.name, func(t *testing.T) {
					ctx := t.Context()
					if scenario.userNamespace != "" {
						ctx = types.WithAuthInfo(ctx, &identity.StaticRequester{Type: types.TypeUser, Namespace: scenario.userNamespace})
					}
					delegate := &namespaceTestServer{}
					result := rpc.invoke(ctx, WithStorageNamespaceChecks(delegate), scenario.requestNamespace)
					if scenario.code == 0 {
						require.Nil(t, result)
						require.Equal(t, 1, delegate.calls)
					} else {
						require.NotNil(t, result)
						require.Equal(t, scenario.code, result.Code)
						require.Zero(t, delegate.calls)
					}
				})
			}
		})
	}
}
