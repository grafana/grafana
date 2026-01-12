package navtreeimpl

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

// Test fixtures
func setupTestContext() *contextmodel.ReqContext {
	httpReq, _ := http.NewRequest(http.MethodGet, "", nil)
	return &contextmodel.ReqContext{
		SignedInUser: &user.SignedInUser{
			UserID:  1,
			OrgID:   1,
			OrgRole: org.RoleAdmin,
		},
		Context: &web.Context{Req: httpReq},
	}
}

func setupTestService(permissions []ac.Permission, featureFlags ...string) ServiceImpl {
	// Convert string slice to []any for WithFeatures
	flags := make([]any, len(featureFlags))
	for i, flag := range featureFlags {
		flags[i] = flag
	}
	return ServiceImpl{
		log:           log.New("navtree"),
		cfg:           setting.NewCfg(),
		accessControl: accesscontrolmock.New().WithPermissions(permissions),
		features:      featuremgmt.WithFeatures(flags...),
	}
}

func fullPermissions() []ac.Permission {
	return []ac.Permission{
		{Action: ac.ActionAlertingRuleRead, Scope: "*"},
		{Action: ac.ActionAlertingNotificationsRead, Scope: "*"},
		{Action: ac.ActionAlertingRoutesRead, Scope: "*"},
		{Action: ac.ActionAlertingInstanceRead, Scope: "*"},
	}
}

// Helper to find a nav link by ID
func findNavLink(navLink *navtree.NavLink, id string) *navtree.NavLink {
	if navLink == nil {
		return nil
	}
	if navLink.Id == id {
		return navLink
	}
	for _, child := range navLink.Children {
		if found := findNavLink(child, id); found != nil {
			return found
		}
	}
	return nil
}

// Helper to check if a nav link has a child with given ID
func hasChildWithId(parent *navtree.NavLink, childId string) bool {
	if parent == nil {
		return false
	}
	for _, child := range parent.Children {
		if child.Id == childId {
			return true
		}
	}
	return false
}

func TestBuildAlertNavLinks_FeatureToggle(t *testing.T) {
	reqCtx := setupTestContext()
	permissions := fullPermissions()

	t.Run("Should use legacy navigation when flag is off", func(t *testing.T) {
		service := setupTestService(permissions) // No feature flags

		navLink := service.buildAlertNavLinks(reqCtx)
		require.NotNil(t, navLink)
		require.Equal(t, "Alerting", navLink.Text)
		require.Equal(t, navtree.NavIDAlerting, navLink.Id)

		// Legacy structure: flat children without nested items
		require.NotEmpty(t, navLink.Children)
		alertList := findNavLink(navLink, "alert-list")
		receivers := findNavLink(navLink, "receivers")

		require.NotNil(t, alertList, "Should have alert-list in legacy navigation")
		require.NotNil(t, receivers, "Should have receivers in legacy navigation")
		require.Empty(t, alertList.Children, "Legacy items should not have nested children")
		require.Empty(t, receivers.Children, "Legacy items should not have nested children")
	})

	t.Run("Should use V2 navigation when flag is on", func(t *testing.T) {
		service := setupTestService(permissions, "alertingNavigationV2")

		navLink := service.buildAlertNavLinks(reqCtx)
		require.NotNil(t, navLink)
		require.Equal(t, "Alerting", navLink.Text)
		require.Equal(t, navtree.NavIDAlerting, navLink.Id)

		// V2 structure: grouped parents with nested children
		require.NotEmpty(t, navLink.Children)

		// Verify all expected parent items exist with children
		expectedParents := []string{"alert-rules", "notification-config", "alerting-settings"}
		for _, parentId := range expectedParents {
			parent := findNavLink(navLink, parentId)
			require.NotNil(t, parent, "Should have %s parent in V2 navigation", parentId)
			require.NotEmpty(t, parent.Children, "V2 parent %s should have children", parentId)
		}

		// Verify alert-rules has expected tab
		alertRules := findNavLink(navLink, "alert-rules")
		require.True(t, hasChildWithId(alertRules, "alert-rules-list"), "Should have alert-rules-list tab")
	})
}

func TestBuildAlertNavLinks_Legacy(t *testing.T) {
	reqCtx := setupTestContext()

	t.Run("Should include all expected items in legacy navigation", func(t *testing.T) {
		service := setupTestService(fullPermissions())
		navLink := service.buildAlertNavLinksLegacy(reqCtx)
		require.NotNil(t, navLink)

		expectedIds := []string{"alert-list", "receivers", "am-routes", "alerting-admin"}
		for _, expectedId := range expectedIds {
			require.NotNil(t, findNavLink(navLink, expectedId), "Should have %s in legacy navigation", expectedId)
		}
	})

	t.Run("Should respect permissions in legacy navigation", func(t *testing.T) {
		limitedPermissions := []ac.Permission{
			{Action: ac.ActionAlertingRuleRead, Scope: "*"},
		}
		limitedService := setupTestService(limitedPermissions)

		navLink := limitedService.buildAlertNavLinksLegacy(reqCtx)
		require.NotNil(t, navLink)

		require.NotNil(t, findNavLink(navLink, "alert-list"), "Should have alert rules with read permission")
		require.Nil(t, findNavLink(navLink, "receivers"), "Should not have contact points without notification permissions")
	})
}

func TestBuildAlertNavLinks_V2(t *testing.T) {
	reqCtx := setupTestContext()
	allFeatureFlags := []string{"alertingNavigationV2", "alertingTriage", "alertingCentralAlertHistory", "alertRuleRestore", "alertingRuleRecoverDeleted"}
	service := setupTestService(fullPermissions(), allFeatureFlags...)

	t.Run("Should have correct parent structure in V2 navigation", func(t *testing.T) {
		navLink := service.buildAlertNavLinks(reqCtx)
		require.NotNil(t, navLink)
		require.NotEmpty(t, navLink.Children)

		// Verify all parent items exist with children
		parentIds := []string{"alert-rules", "notification-config", "alerting-settings"}
		for _, parentId := range parentIds {
			parent := findNavLink(navLink, parentId)
			require.NotNil(t, parent, "Should have parent %s in V2 navigation", parentId)
			require.NotEmpty(t, parent.Children, "Parent %s should have children", parentId)
		}
	})

	t.Run("Should have correct tabs under each parent", func(t *testing.T) {
		navLink := service.buildAlertNavLinks(reqCtx)
		require.NotNil(t, navLink)

		// Table-driven test for tab verification
		tests := []struct {
			parentId     string
			expectedTabs []string
		}{
			{"alert-rules", []string{"alert-rules-list", "alert-rules-recently-deleted"}},
			{"notification-config", []string{"notification-config-contact-points", "notification-config-policies", "notification-config-templates", "notification-config-time-intervals"}},
		}

		for _, tt := range tests {
			parent := findNavLink(navLink, tt.parentId)
			require.NotNil(t, parent, "Should have %s parent", tt.parentId)

			for _, expectedTab := range tt.expectedTabs {
				require.True(t, hasChildWithId(parent, expectedTab), "Parent %s should have tab %s", tt.parentId, expectedTab)
			}
		}
	})

	t.Run("Should respect permissions in V2 navigation", func(t *testing.T) {
		limitedPermissions := []ac.Permission{
			{Action: ac.ActionAlertingRuleRead, Scope: "*"},
		}
		limitedService := setupTestService(limitedPermissions, "alertingNavigationV2")

		navLink := limitedService.buildAlertNavLinks(reqCtx)
		require.NotNil(t, navLink)

		// Should not have notification-config without notification permissions
		require.Nil(t, findNavLink(navLink, "notification-config"), "Should not have notification-config without permissions")
	})

	t.Run("Should exclude future items from V2 navigation", func(t *testing.T) {
		navLink := service.buildAlertNavLinks(reqCtx)
		require.NotNil(t, navLink)

		// Verify future items are not present
		futureIds := []string{
			"alert-rules-recording-rules",
			"alert-rules-evaluation-chains",
			"insights-alert-optimizer",
			"insights-notification-history",
		}

		for _, futureId := range futureIds {
			require.Nil(t, findNavLink(navLink, futureId), "Should not have future item %s", futureId)
		}
	})
}
