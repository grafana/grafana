package libraryelements

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

func TestFilterK8sLibraryPanelsEmptyFolderFilter(t *testing.T) {
	handler := &libraryElementsK8sHandler{}
	items := []unstructured.Unstructured{{Object: map[string]interface{}{
		"metadata": map[string]interface{}{"name": "panel"},
		"spec":     map[string]interface{}{"type": "text", "title": "Panel"},
	}}}

	require.Len(t, handler.filterK8sLibraryPanels(nil, items, model.SearchLibraryElementsQuery{}, nil), 1)
	require.Empty(t, handler.filterK8sLibraryPanels(nil, items, model.SearchLibraryElementsQuery{}, []string{}))
}

func TestFilterK8sLibraryPanelsFolderTitleSearchWithDeprecatedIDFilter(t *testing.T) {
	handler := &libraryElementsK8sHandler{folderService: &foldertest.FakeService{ExpectedFolder: &folder.Folder{
		ID: 42, UID: "folder-uid", Title: "Matching folder", OrgID: 1,
	}}}
	items := []unstructured.Unstructured{{Object: map[string]interface{}{
		"metadata": map[string]interface{}{
			"name":        "panel",
			"annotations": map[string]interface{}{"grafana.app/folder": "folder-uid"},
		},
		"spec": map[string]interface{}{"type": "text", "title": "Panel"},
	}}}
	reqContext := &contextmodel.ReqContext{
		Context:      &web.Context{Req: &http.Request{}},
		SignedInUser: &user.SignedInUser{OrgID: 1},
	}

	deprecatedFilter := model.SearchLibraryElementsQuery{SearchString: "matching", FolderFilter: "42"} // nolint:staticcheck
	require.Len(t, handler.filterK8sLibraryPanels(reqContext, items, deprecatedFilter, []string{"folder-uid"}), 1)

	uidFilter := model.SearchLibraryElementsQuery{SearchString: "matching", FolderFilterUIDs: "folder-uid"}
	require.Empty(t, handler.filterK8sLibraryPanels(reqContext, items, uidFilter, []string{"folder-uid"}))
}

func TestFolderUIDFromLegacyID(t *testing.T) {
	reqContext := &contextmodel.ReqContext{
		Context: &web.Context{Req: &http.Request{}},
		SignedInUser: &user.SignedInUser{
			OrgID: 1,
		},
	}

	t.Run("root folder", func(t *testing.T) {
		handler := &libraryElementsK8sHandler{}

		uid, ok := handler.folderUIDFromLegacyID(reqContext, 0)

		require.True(t, ok)
		require.Equal(t, accesscontrol.GeneralFolderUID, uid)
	})

	t.Run("folder", func(t *testing.T) {
		handler := &libraryElementsK8sHandler{
			folderService: &foldertest.FakeService{
				ExpectedFolder: &folder.Folder{ID: 42, UID: "folder-uid", OrgID: 1},
			},
		}

		uid, ok := handler.folderUIDFromLegacyID(reqContext, 42)

		require.True(t, ok)
		require.Equal(t, "folder-uid", uid)
	})
}

func TestResolveFolderTitlesUsesLegacyRootName(t *testing.T) {
	handler := &libraryElementsK8sHandler{}
	items := []unstructured.Unstructured{{Object: map[string]interface{}{
		"metadata": map[string]interface{}{
			"annotations": map[string]interface{}{
				"grafana.app/folder": accesscontrol.GeneralFolderUID,
			},
		},
	}}}

	titles := handler.resolveFolderTitles(&contextmodel.ReqContext{}, items)

	require.Equal(t, dashboards.RootFolderName, titles[accesscontrol.GeneralFolderUID])
}

func TestFilterLibraryPanelsByPermission(t *testing.T) {
	panels := []model.LibraryElementDTO{
		{UID: "valid-panel-1", Name: "Valid Panel 1", Type: "text"},
		{UID: "problematic-panel", Name: "Problematic Panel", Type: "text"},
		{UID: "valid-panel-2", Name: "Valid Panel 2", Type: "text"},
	}

	user := &user.SignedInUser{
		UserID: 1,
		OrgID:  1,
		Login:  "test-user",
	}

	reqContext := &contextmodel.ReqContext{
		Context: &web.Context{
			Req: &http.Request{},
		},
		SignedInUser: user,
	}

	t.Run("All panels have valid permissions", func(t *testing.T) {
		// Use fake AccessControl that allows all panels
		ac := &fakeAccessControl{
			evaluateFunc: func(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
				return true, nil // all panels are allowed
			},
		}

		service := &LibraryElementService{
			AccessControl: ac,
			log:           log.NewNopLogger(),
		}

		result, err := service.filterLibraryPanelsByPermission(reqContext, panels)

		require.NoError(t, err)
		require.Len(t, result, 3, "Should return all 3 panels when permissions allow")
		require.Equal(t, "valid-panel-1", result[0].UID)
		require.Equal(t, "problematic-panel", result[1].UID)
		require.Equal(t, "valid-panel-2", result[2].UID)
	})

	t.Run("Some panels have permission evaluation errors - graceful handling", func(t *testing.T) {
		// Use controlled fake AccessControl to fail for the problematic panel
		// We'll use a simple counter to fail on the second call (which should be the problematic panel)
		callCount := 0
		ac := &fakeAccessControl{
			evaluateFunc: func(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
				callCount++
				if callCount == 2 { // Second panel (problematic-panel)
					// Simulate folder not found error during scope resolution
					return false, folder.ErrFolderNotFound
				}
				return true, nil // allow all other panels
			},
		}

		service := &LibraryElementService{
			AccessControl: ac,
			log:           log.NewNopLogger(),
		}

		result, err := service.filterLibraryPanelsByPermission(reqContext, panels)

		// With the NEW code (continue), this should succeed gracefully
		require.NoError(t, err, "Should handle permission evaluation errors gracefully")
		require.Len(t, result, 2, "Should return only the valid panels, skipping the problematic one")
		require.Equal(t, "valid-panel-1", result[0].UID)
		require.Equal(t, "valid-panel-2", result[1].UID)

		// The problematic panel should be skipped (not included in results)
		for _, panel := range result {
			require.NotEqual(t, "problematic-panel", panel.UID, "Problematic panel should be skipped")
		}
	})

	t.Run("Permission denied for some panels - should be filtered out", func(t *testing.T) {
		// Use official AccessControl mock to deny permission for the problematic panel (but no error)
		callCount := 0
		ac := &fakeAccessControl{
			evaluateFunc: func(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
				callCount++
				if callCount == 2 { // Second panel (problematic-panel)
					return false, nil // denied but no error
				}
				return true, nil // allow all other panels
			},
		}

		service := &LibraryElementService{
			AccessControl: ac,
			log:           log.NewNopLogger(),
		}

		result, err := service.filterLibraryPanelsByPermission(reqContext, panels)

		require.NoError(t, err)
		require.Len(t, result, 2, "Should return only panels user has permission for")
		require.Equal(t, "valid-panel-1", result[0].UID)
		require.Equal(t, "valid-panel-2", result[1].UID)
	})

	t.Run("All panels have permission evaluation errors - should return empty list", func(t *testing.T) {
		// Use controlled fake AccessControl to fail for all panels
		ac := &fakeAccessControl{
			evaluateFunc: func(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
				return false, errors.New("scope resolution failed")
			},
		}

		service := &LibraryElementService{
			AccessControl: ac,
			log:           log.NewNopLogger(),
		}

		result, err := service.filterLibraryPanelsByPermission(reqContext, panels)

		// With graceful error handling, should return empty list instead of failing
		require.NoError(t, err, "Should handle all permission evaluation errors gracefully")
		require.Len(t, result, 0, "Should return empty list when all panels have permission evaluation errors")
	})

	t.Run("Empty input should return empty output", func(t *testing.T) {
		ac := &fakeAccessControl{}
		service := &LibraryElementService{
			AccessControl: ac,
			log:           log.NewNopLogger(),
		}

		result, err := service.filterLibraryPanelsByPermission(reqContext, []model.LibraryElementDTO{})

		require.NoError(t, err)
		require.Len(t, result, 0, "Should return empty list for empty input")
	})
}

// fakeAccessControl allows more granular control over evaluation results per call
type fakeAccessControl struct {
	evaluateFunc func(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error)
}

var _ accesscontrol.AccessControl = new(fakeAccessControl)

func (f *fakeAccessControl) Evaluate(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
	if f.evaluateFunc != nil {
		return f.evaluateFunc(ctx, user, evaluator)
	}
	return true, nil
}

func (f *fakeAccessControl) RegisterScopeAttributeResolver(prefix string, resolver accesscontrol.ScopeAttributeResolver) {
	// no-op for testing
}

func (f *fakeAccessControl) WithoutResolvers() accesscontrol.AccessControl {
	return f
}

func (f *fakeAccessControl) InvalidateResolverCache(orgID int64, scope string) {
	// no-op for testing
}
