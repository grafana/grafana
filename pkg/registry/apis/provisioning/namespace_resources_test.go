package provisioning

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func TestParseNamespaceListOptions(t *testing.T) {
	managed, unmanaged := true, false
	for _, tc := range []struct {
		name    string
		query   string
		want    resources.NamespaceListOptions
		wantErr string
	}{
		{
			name:  "no parameters",
			query: "",
			want:  resources.NamespaceListOptions{},
		},
		{
			name:  "what migrate asks for",
			query: "managed=false&group=dashboard.grafana.app&resource=dashboards&limit=100",
			want: resources.NamespaceListOptions{
				Managed:  &unmanaged,
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
				Limit:    100,
			},
		},
		{
			name:  "one repository",
			query: "manager.kind=repo&manager.id=my-repo&managed=true",
			want: resources.NamespaceListOptions{
				ManagerKind: "repo",
				ManagerID:   "my-repo",
				Managed:     &managed,
			},
		},
		{
			name:  "opting in to the source-of-truth fields",
			query: "fields=path,hash",
			want:  resources.NamespaceListOptions{Fields: sets.New("path", "hash")},
		},
		{
			name:    "an unknown projection is rejected rather than ignored",
			query:   "fields=path,title",
			wantErr: `invalid fields "title": expected hash, path, time`,
		},
		{
			name:    "a misspelled filter is rejected rather than ignored",
			query:   "manage=false",
			wantErr: `unknown parameter "manage": expected continue, fields, group, limit, managed, manager.id, manager.kind, resource`,
		},
		{
			name:    "managed must be a boolean",
			query:   "managed=sometimes",
			wantErr: `invalid managed "sometimes": expected true or false`,
		},
		{
			name:    "limit must be a non-negative number",
			query:   "limit=-1",
			wantErr: `invalid limit "-1": expected a non-negative number`,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			values, err := url.ParseQuery(tc.query)
			require.NoError(t, err)
			got, err := parseNamespaceListOptions(values)
			if tc.wantErr != "" {
				require.EqualError(t, err, tc.wantErr)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
		})
	}
}

func TestHandleNamespaceResources(t *testing.T) {
	t.Run("serves the list for the caller's namespace", func(t *testing.T) {
		lister := resources.NewMockNamespaceLister(t)
		lister.EXPECT().
			ListNamespace(mock.Anything, "stacks-1", resources.NamespaceListOptions{Limit: 2}).
			Return(&provisioning.ResourceList{
				Items: []provisioning.ResourceListItem{{
					Group:    "dashboard.grafana.app",
					Resource: "dashboards",
					Name:     "db-1",
					Manager:  &provisioning.ResourceManager{Kind: utils.ManagerKindRepo, Identity: "my-repo"},
				}},
			}, nil).Once()

		b := &APIBuilder{namespaceLister: lister, gv: provisioning.SchemeGroupVersion}
		rec := serveNamespaceResources(t, b, "stacks-1", "?limit=2")

		require.Equal(t, http.StatusOK, rec.Code)
		var got provisioning.ResourceList
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
		require.Equal(t, provisioning.SchemeGroupVersion.String(), got.APIVersion)
		require.Equal(t, "ResourceList", got.Kind)
		require.Equal(t, &provisioning.ResourceManager{Kind: utils.ManagerKindRepo, Identity: "my-repo"}, got.Items[0].Manager)
	})

	// A service identity scoped to every namespace reports "*" as its own namespace, which
	// would be searched instead of the one the route names.
	t.Run("searches the route's namespace, not the caller identity's", func(t *testing.T) {
		lister := resources.NewMockNamespaceLister(t)
		lister.EXPECT().
			ListNamespace(mock.Anything, "stacks-1", resources.NamespaceListOptions{}).
			Return(&provisioning.ResourceList{}, nil).Once()

		b := &APIBuilder{namespaceLister: lister, gv: provisioning.SchemeGroupVersion}
		rec := serveNamespaceResourcesAs(t, b, "stacks-1", "*", "")
		require.Equal(t, http.StatusOK, rec.Code)
	})

	// url.URL.Query() drops a parameter whose escaping is malformed and reports no error,
	// so the filter would vanish and the endpoint would answer everything.
	t.Run("rejects a malformed query escape rather than dropping the filter", func(t *testing.T) {
		b := &APIBuilder{namespaceLister: resources.NewMockNamespaceLister(t), gv: provisioning.SchemeGroupVersion}
		rec := serveNamespaceResources(t, b, "stacks-1", "?managed=false%ZZ")
		require.Equal(t, http.StatusBadRequest, rec.Code)
	})

	t.Run("rejects an unparseable parameter before reading anything", func(t *testing.T) {
		b := &APIBuilder{namespaceLister: resources.NewMockNamespaceLister(t), gv: provisioning.SchemeGroupVersion}
		rec := serveNamespaceResources(t, b, "stacks-1", "?managed=maybe")
		require.Equal(t, http.StatusBadRequest, rec.Code)
	})
}

func serveNamespaceResources(t *testing.T, b *APIBuilder, namespace, query string) *httptest.ResponseRecorder {
	t.Helper()
	return serveNamespaceResourcesAs(t, b, namespace, namespace, query)
}

// serveNamespaceResourcesAs serves the route for routeNamespace with a caller whose identity is
// scoped to identityNamespace, which the apiserver sets independently of each other.
func serveNamespaceResourcesAs(t *testing.T, b *APIBuilder, routeNamespace, identityNamespace, query string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/apis/provisioning.grafana.app/v0alpha1/namespaces/"+routeNamespace+"/resources"+query, nil)
	ctx := authlib.WithAuthInfo(req.Context(), &identity.StaticRequester{
		Type:      authlib.TypeUser,
		UserID:    1,
		Namespace: identityNamespace,
	})
	req = req.WithContext(request.WithNamespace(ctx, routeNamespace))
	rec := httptest.NewRecorder()
	b.handleNamespaceResources(rec, req)
	return rec
}

// The namespace resource list answers the same question as stats, so it is gated the
// same way. The rows it returns are filtered per caller by the index itself.
func TestAuthorizeNamespaceResources(t *testing.T) {
	ctx := context.Background()
	const ns = "default"

	statsRead := func(req authlib.CheckRequest) bool {
		return req.Verb == "get" &&
			req.Group == provisioning.GROUP &&
			req.Resource == "stats" &&
			req.Namespace == ns
	}
	attrs := authorizer.AttributesRecord{Resource: "resources", Namespace: ns, Verb: "get"}

	t.Run("an admin is allowed", func(t *testing.T) {
		checker := auth.NewMockAccessChecker(t)
		checker.EXPECT().Check(mock.Anything, mock.MatchedBy(statsRead), "").Return(nil)

		b := &APIBuilder{accessWithAdmin: checker}
		decision, _, err := b.authorizeResource(ctx, attrs)
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionAllow, decision)
	})

	t.Run("anyone else is denied", func(t *testing.T) {
		checker := auth.NewMockAccessChecker(t)
		checker.EXPECT().Check(mock.Anything, mock.MatchedBy(statsRead), "").Return(mockForbidden())

		b := &APIBuilder{accessWithAdmin: checker}
		decision, _, err := b.authorizeResource(ctx, attrs)
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionDeny, decision)
	})
}
