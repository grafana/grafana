package libraryelements

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestPanelFolderContext(t *testing.T) {
	elements := []model.LibraryElementDTO{
		{UID: "panel-1", FolderUID: "folder-a"},
		{UID: "panel-2", FolderUID: ""}, // general folder
	}
	ctx := withPanelFolders(context.Background(), elements)

	t.Run("returns the recorded folder for a known panel", func(t *testing.T) {
		f, ok := panelFolderFromContext(ctx, "panel-1")
		assert.True(t, ok)
		assert.Equal(t, "folder-a", f)
	})

	t.Run("records the general (empty) folder", func(t *testing.T) {
		f, ok := panelFolderFromContext(ctx, "panel-2")
		assert.True(t, ok)
		assert.Equal(t, "", f)
	})

	t.Run("reports miss for an unknown panel", func(t *testing.T) {
		_, ok := panelFolderFromContext(ctx, "panel-x")
		assert.False(t, ok)
	})

	t.Run("reports miss when no map is present", func(t *testing.T) {
		_, ok := panelFolderFromContext(context.Background(), "panel-1")
		assert.False(t, ok)
	})
}

func TestLibraryPanelUIDScopeResolver_UnifiedStorageWithoutContextFolder(t *testing.T) {
	for _, tc := range []struct {
		name      string
		mode      grafanarest.DualWriterMode
		folderUID string
		status    int
	}{
		{name: "mode 3", mode: grafanarest.Mode3, folderUID: "folder-a", status: http.StatusOK},
		{name: "mode 4", mode: grafanarest.Mode4, folderUID: "folder-a", status: http.StatusOK},
		{name: "mode 5", mode: grafanarest.Mode5, folderUID: "folder-a", status: http.StatusOK},
		{name: "general folder", mode: grafanarest.Mode5, status: http.StatusOK},
		{name: "lookup denied", mode: grafanarest.Mode5, status: http.StatusForbidden},
		{name: "missing panel", mode: grafanarest.Mode5, status: http.StatusNotFound},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
				setting.LibraryPanelResource: {DualWriterMode: tc.mode},
			}
			calls := 0
			provider := resolverRestConfigProvider{roundTrip: func(req *http.Request) (*http.Response, error) {
				calls++
				require.Equal(t, "/apis/dashboard.grafana.app/v0alpha1/namespaces/org-2/librarypanels/panel-1", req.URL.Path)
				require.True(t, identity.IsServiceIdentity(req.Context()))
				lookupUser, err := identity.GetRequester(req.Context())
				require.NoError(t, err)
				require.Equal(t, int64(2), lookupUser.GetOrgID())
				body := fmt.Sprintf(`{"apiVersion":"dashboard.grafana.app/v0alpha1","kind":"LibraryPanel","metadata":{"name":"panel-1","annotations":{"grafana.app/folder":%q}}}`, tc.folderUID)
				if tc.status != http.StatusOK {
					body = fmt.Sprintf(`{"apiVersion":"v1","kind":"Status","status":"Failure","message":"lookup failed","code":%d}`, tc.status)
				}
				return &http.Response{StatusCode: tc.status, Header: http.Header{"Content-Type": []string{"application/json"}}, Body: io.NopCloser(strings.NewReader(body))}, nil
			}}
			folderSvc := foldertest.NewFakeService()
			svc := &LibraryElementService{
				Cfg:        cfg,
				k8sHandler: newLibraryElementsK8sHandler(cfg, provider, folderSvc, nil, nil),
			}
			_, resolver := LibraryPanelUIDScopeResolver(svc, folderSvc)
			requester := &user.SignedInUser{UserID: 1, OrgID: 2}
			ctx := identity.WithRequester(t.Context(), requester)
			scopes, err := resolver.Resolve(ctx, 2, "library.panels:uid:panel-1")
			require.Equal(t, 1, calls)
			if tc.status != http.StatusOK {
				require.Error(t, err)
				require.Empty(t, scopes)
				return
			}
			require.NoError(t, err)
			folderUID := tc.folderUID
			if folderUID == "" {
				folderUID = "general"
			}
			require.Contains(t, scopes, "folders:uid:"+folderUID)
			require.Contains(t, scopes, "library.panels:uid:panel-1")
			currentUser, err := identity.GetRequester(ctx)
			require.NoError(t, err)
			require.Same(t, requester, currentUser)
		})
	}
}

type resolverRoundTripper func(*http.Request) (*http.Response, error)

func (f resolverRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) { return f(req) }

type resolverRestConfigProvider struct {
	testDirectRestConfigProvider
	roundTrip resolverRoundTripper
}

func (p resolverRestConfigProvider) GetDirectRestConfig(*contextmodel.ReqContext) *clientrest.Config {
	return &clientrest.Config{Host: "http://localhost", Transport: p.roundTrip}
}

// TestLibraryPanelUIDScopeResolver_UsesContextFolder verifies that when the
// panel's folder is provided via the request context, the resolver derives the
// folder scope from it and does NOT perform the per-panel database lookup. The
// service is constructed without a SQLStore, so any fallback to
// getLibraryElementByUid would panic — proving the lookup is skipped.
func TestLibraryPanelUIDScopeResolver_UsesContextFolder(t *testing.T) {
	folderSvc := foldertest.NewFakeService() // GetParents returns no ancestors
	svc := &LibraryElementService{
		folderService: folderSvc,
		treeCache:     newFolderTreeCache(folderSvc, false),
		log:           log.NewNopLogger(),
		// deliberately no SQLStore: getLibraryElementByUid must not be reached
	}
	_, resolver := LibraryPanelUIDScopeResolver(svc, folderSvc)

	usr := &user.SignedInUser{UserID: 1, OrgID: 1}
	ctx := identity.WithRequester(context.Background(), usr)
	ctx = withPanelFolders(ctx, []model.LibraryElementDTO{{UID: "panel-1", FolderUID: "folder-a"}})

	scopes, err := resolver.Resolve(ctx, 1, ScopeLibraryPanelsProvider.GetResourceScopeUID("panel-1"))
	require.NoError(t, err)

	assert.Contains(t, scopes, folder.ScopeFoldersProvider.GetResourceScopeUID("folder-a"),
		"resolved scopes should include the panel's folder scope")
	assert.Contains(t, scopes, ScopeLibraryPanelsProvider.GetResourceScopeUID("panel-1"),
		"resolved scopes should include the panel scope")
}
