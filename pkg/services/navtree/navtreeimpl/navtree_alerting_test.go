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

func TestBuildAlertNavLinks(t *testing.T) {
	reqCtx := setupTestContext()
	allFeatureFlags := []string{"alertingTriage", "alertingCentralAlertHistory", "alertRuleRestore", "alertingRuleRecoverDeleted"}
	service := setupTestService(fullPermissions(), allFeatureFlags...)

	t.Run("Should have correct parent structure", func(t *testing.T) {
		navLink := service.buildAlertNavLinks(reqCtx)
		require.NotNil(t, navLink)
		require.NotEmpty(t, navLink.Children)

		// Verify all parent items exist with children
		parentIds := []string{"alert-rules", "notification-config", "insights", "alerting-settings"}
		for _, parentId := range parentIds {
			parent := findNavLink(navLink, parentId)
			require.NotNil(t, parent, "Should have parent %s", parentId)
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
			{"insights", []string{"insights-system", "insights-history"}},
		}

		for _, tt := range tests {
			parent := findNavLink(navLink, tt.parentId)
			require.NotNil(t, parent, "Should have %s parent", tt.parentId)

			for _, expectedTab := range tt.expectedTabs {
				require.True(t, hasChildWithId(parent, expectedTab), "Parent %s should have tab %s", tt.parentId, expectedTab)
			}
		}
	})

	t.Run("Should respect permissions", func(t *testing.T) {
		limitedPermissions := []ac.Permission{
			{Action: ac.ActionAlertingRuleRead, Scope: "*"},
		}
		limitedService := setupTestService(limitedPermissions)

		navLink := limitedService.buildAlertNavLinks(reqCtx)
		require.NotNil(t, navLink)

		// Should not have notification-config without notification permissions
		require.Nil(t, findNavLink(navLink, "notification-config"), "Should not have notification-config without permissions")
	})

	t.Run("Should exclude future items", func(t *testing.T) {
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
