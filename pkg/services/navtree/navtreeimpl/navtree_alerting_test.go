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

func TestBuildAlertNavLinks_FeatureToggle(t *testing.T) {
	httpReq, _ := http.NewRequest(http.MethodGet, "", nil)
	reqCtx := &contextmodel.ReqContext{
		SignedInUser: &user.SignedInUser{
			UserID:  1,
			OrgID:   1,
			OrgRole: org.RoleAdmin,
		},
		Context: &web.Context{Req: httpReq},
	}

	permissions := []ac.Permission{
		{Action: ac.ActionAlertingRuleRead, Scope: "*"},
		{Action: ac.ActionAlertingNotificationsRead, Scope: "*"},
		{Action: ac.ActionAlertingRoutesRead, Scope: "*"},
		{Action: ac.ActionAlertingInstanceRead, Scope: "*"},
	}

	t.Run("Should use legacy navigation when flag is off", func(t *testing.T) {
		service := ServiceImpl{
			log:           log.New("navtree"),
			cfg:           setting.NewCfg(),
			accessControl: accesscontrolmock.New().WithPermissions(permissions),
			features:      featuremgmt.WithFeatures(), // Flag off by default
		}

		navLink := service.buildAlertNavLinks(reqCtx)
		require.NotNil(t, navLink)
		require.Equal(t, "Alerting", navLink.Text)
		require.Equal(t, navtree.NavIDAlerting, navLink.Id)

		// Check that children are flat (legacy structure)
		children := navLink.Children
		require.NotEmpty(t, children)

		// In legacy, items are direct children, not grouped
		hasAlertRules := false
		hasContactPoints := false
		for _, child := range children {
			if child.Id == "alert-list" {
				hasAlertRules = true
				require.Empty(t, child.Children, "Legacy navigation should not have nested children")
			}
			if child.Id == "receivers" {
				hasContactPoints = true
				require.Empty(t, child.Children, "Legacy navigation should not have nested children")
			}
		}
		require.True(t, hasAlertRules, "Should have alert rules in legacy navigation")
		require.True(t, hasContactPoints, "Should have contact points in legacy navigation")
	})

	t.Run("Should use V2 navigation when flag is on", func(t *testing.T) {
		service := ServiceImpl{
			log:           log.New("navtree"),
			cfg:           setting.NewCfg(),
			accessControl: accesscontrolmock.New().WithPermissions(permissions),
			features:      featuremgmt.WithFeatures("alertingNavigationV2"),
		}

		navLink := service.buildAlertNavLinks(reqCtx)
		require.NotNil(t, navLink)
		require.Equal(t, "Alerting", navLink.Text)
		require.Equal(t, navtree.NavIDAlerting, navLink.Id)

		// Check that children are grouped (V2 structure)
		children := navLink.Children
		require.NotEmpty(t, children)

		// In V2, we should have parent items with children
		hasAlertRulesParent := false
		hasNotificationConfigParent := false
		hasInsightsParent := false
		hasSettingsParent := false

		for _, child := range children {
			if child.Id == "alert-rules" {
				hasAlertRulesParent = true
				require.NotEmpty(t, child.Children, "V2 navigation should have nested children for alert-rules")
				// Check for expected tabs
				hasAlertRulesTab := false
				for _, tab := range child.Children {
					if tab.Id == "alert-rules-list" {
						hasAlertRulesTab = true
					}
				}
				require.True(t, hasAlertRulesTab, "Should have alert-rules-list tab")
			}
			if child.Id == "notification-config" {
				hasNotificationConfigParent = true
				require.NotEmpty(t, child.Children, "V2 navigation should have nested children for notification-config")
			}
			if child.Id == "insights" {
				hasInsightsParent = true
				require.NotEmpty(t, child.Children, "V2 navigation should have nested children for insights")
			}
			if child.Id == "alerting-settings" {
				hasSettingsParent = true
				require.NotEmpty(t, child.Children, "V2 navigation should have nested children for settings")
			}
		}

		require.True(t, hasAlertRulesParent, "Should have alert-rules parent in V2 navigation")
		require.True(t, hasNotificationConfigParent, "Should have notification-config parent in V2 navigation")
		require.True(t, hasInsightsParent, "Should have insights parent in V2 navigation")
		require.True(t, hasSettingsParent, "Should have settings parent in V2 navigation")
	})
}

func TestBuildAlertNavLinks_Legacy(t *testing.T) {
	httpReq, _ := http.NewRequest(http.MethodGet, "", nil)
	reqCtx := &contextmodel.ReqContext{
		SignedInUser: &user.SignedInUser{
			UserID:  1,
			OrgID:   1,
			OrgRole: org.RoleAdmin,
		},
		Context: &web.Context{Req: httpReq},
	}

	permissions := []ac.Permission{
		{Action: ac.ActionAlertingRuleRead, Scope: "*"},
		{Action: ac.ActionAlertingNotificationsRead, Scope: "*"},
		{Action: ac.ActionAlertingRoutesRead, Scope: "*"},
		{Action: ac.ActionAlertingInstanceRead, Scope: "*"},
	}

	service := ServiceImpl{
		log:           log.New("navtree"),
		cfg:           setting.NewCfg(),
		accessControl: accesscontrolmock.New().WithPermissions(permissions),
		features:      featuremgmt.WithFeatures(),
	}

	t.Run("Should include all expected items in legacy navigation", func(t *testing.T) {
		navLink := service.buildAlertNavLinksLegacy(reqCtx)
		require.NotNil(t, navLink)

		children := navLink.Children
		expectedIds := []string{"alert-list", "receivers", "am-routes", "alerting-admin"}

		foundIds := make(map[string]bool)
		for _, child := range children {
			foundIds[child.Id] = true
		}

		for _, expectedId := range expectedIds {
			require.True(t, foundIds[expectedId], "Should have %s in legacy navigation", expectedId)
		}
	})

	t.Run("Should respect permissions in legacy navigation", func(t *testing.T) {
		// User with limited permissions
		limitedPermissions := []ac.Permission{
			{Action: ac.ActionAlertingRuleRead, Scope: "*"},
		}

		limitedService := ServiceImpl{
			log:           log.New("navtree"),
			cfg:           setting.NewCfg(),
			accessControl: accesscontrolmock.New().WithPermissions(limitedPermissions),
			features:      featuremgmt.WithFeatures(),
		}

		navLink := limitedService.buildAlertNavLinksLegacy(reqCtx)
		require.NotNil(t, navLink)

		children := navLink.Children
		hasAlertRules := false
		hasContactPoints := false

		for _, child := range children {
			if child.Id == "alert-list" {
				hasAlertRules = true
			}
			if child.Id == "receivers" {
				hasContactPoints = true
			}
		}

		require.True(t, hasAlertRules, "Should have alert rules with read permission")
		require.False(t, hasContactPoints, "Should not have contact points without notification permissions")
	})
}

func TestBuildAlertNavLinks_V2(t *testing.T) {
	httpReq, _ := http.NewRequest(http.MethodGet, "", nil)
	reqCtx := &contextmodel.ReqContext{
		SignedInUser: &user.SignedInUser{
			UserID:  1,
			OrgID:   1,
			OrgRole: org.RoleAdmin,
		},
		Context: &web.Context{Req: httpReq},
	}

	permissions := []ac.Permission{
		{Action: ac.ActionAlertingRuleRead, Scope: "*"},
		{Action: ac.ActionAlertingNotificationsRead, Scope: "*"},
		{Action: ac.ActionAlertingRoutesRead, Scope: "*"},
		{Action: ac.ActionAlertingInstanceRead, Scope: "*"},
	}

	service := ServiceImpl{
		log:           log.New("navtree"),
		cfg:           setting.NewCfg(),
		accessControl: accesscontrolmock.New().WithPermissions(permissions),
		features:      featuremgmt.WithFeatures("alertingNavigationV2", "alertingTriage", "alertingCentralAlertHistory", "alertRuleRestore", "alertingRuleRecoverDeleted"),
	}

	t.Run("Should have correct parent structure in V2 navigation", func(t *testing.T) {
		navLink := service.buildAlertNavLinksV2(reqCtx)
		require.NotNil(t, navLink)

		children := navLink.Children
		require.NotEmpty(t, children)

		// Verify parent items exist
		parentIds := []string{"alert-rules", "notification-config", "insights", "alerting-settings"}
		foundParents := make(map[string]bool)

		for _, child := range children {
			if child.Id == "alert-activity" {
				// Alert activity is a direct child, not a parent
				continue
			}
			for _, parentId := range parentIds {
				if child.Id == parentId {
					foundParents[parentId] = true
					require.NotEmpty(t, child.Children, "Parent %s should have children", parentId)
				}
			}
		}

		for _, parentId := range parentIds {
			require.True(t, foundParents[parentId], "Should have parent %s in V2 navigation", parentId)
		}
	})

	t.Run("Should have correct tabs under Alert rules parent", func(t *testing.T) {
		navLink := service.buildAlertNavLinksV2(reqCtx)
		require.NotNil(t, navLink)

		var alertRulesParent *navtree.NavLink
		for _, child := range navLink.Children {
			if child.Id == "alert-rules" {
				alertRulesParent = child
				break
			}
		}

		require.NotNil(t, alertRulesParent, "Should have alert-rules parent")
		require.NotEmpty(t, alertRulesParent.Children, "Alert rules should have tabs")

		tabIds := make(map[string]bool)
		for _, tab := range alertRulesParent.Children {
			tabIds[tab.Id] = true
		}

		require.True(t, tabIds["alert-rules-list"], "Should have alert-rules-list tab")
		require.True(t, tabIds["alert-rules-recently-deleted"], "Should have alert-rules-recently-deleted tab")
	})

	t.Run("Should have correct tabs under Notification configuration parent", func(t *testing.T) {
		navLink := service.buildAlertNavLinksV2(reqCtx)
		require.NotNil(t, navLink)

		var notificationConfigParent *navtree.NavLink
		for _, child := range navLink.Children {
			if child.Id == "notification-config" {
				notificationConfigParent = child
				break
			}
		}

		require.NotNil(t, notificationConfigParent, "Should have notification-config parent")
		require.NotEmpty(t, notificationConfigParent.Children, "Notification config should have tabs")

		tabIds := make(map[string]bool)
		for _, tab := range notificationConfigParent.Children {
			tabIds[tab.Id] = true
		}

		require.True(t, tabIds["notification-config-contact-points"], "Should have contact-points tab")
		require.True(t, tabIds["notification-config-policies"], "Should have policies tab")
		require.True(t, tabIds["notification-config-templates"], "Should have templates tab")
		require.True(t, tabIds["notification-config-time-intervals"], "Should have time-intervals tab")
	})

	t.Run("Should have correct tabs under Insights parent", func(t *testing.T) {
		navLink := service.buildAlertNavLinksV2(reqCtx)
		require.NotNil(t, navLink)

		var insightsParent *navtree.NavLink
		for _, child := range navLink.Children {
			if child.Id == "insights" {
				insightsParent = child
				break
			}
		}

		require.NotNil(t, insightsParent, "Should have insights parent")
		require.NotEmpty(t, insightsParent.Children, "Insights should have tabs")

		tabIds := make(map[string]bool)
		for _, tab := range insightsParent.Children {
			tabIds[tab.Id] = true
		}

		require.True(t, tabIds["insights-system"], "Should have insights-system tab")
		require.True(t, tabIds["insights-history"], "Should have insights-history tab")
	})

	t.Run("Should respect permissions in V2 navigation", func(t *testing.T) {
		// User with limited permissions
		limitedPermissions := []ac.Permission{
			{Action: ac.ActionAlertingRuleRead, Scope: "*"},
		}

		limitedService := ServiceImpl{
			log:           log.New("navtree"),
			cfg:           setting.NewCfg(),
			accessControl: accesscontrolmock.New().WithPermissions(limitedPermissions),
			features:      featuremgmt.WithFeatures("alertingNavigationV2"),
		}

		navLink := limitedService.buildAlertNavLinksV2(reqCtx)
		require.NotNil(t, navLink)

		// Should not have notification-config parent without permissions
		hasNotificationConfig := false
		for _, child := range navLink.Children {
			if child.Id == "notification-config" {
				hasNotificationConfig = true
			}
		}

		require.False(t, hasNotificationConfig, "Should not have notification-config without permissions")
	})

	t.Run("Should exclude future items from V2 navigation", func(t *testing.T) {
		navLink := service.buildAlertNavLinksV2(reqCtx)
		require.NotNil(t, navLink)

		// Check that future items are not present
		futureIds := []string{
			"alert-rules-recording-rules",
			"alert-rules-evaluation-chains",
			"insights-alert-optimizer",
			"insights-notification-history",
		}

		allIds := make(map[string]bool)
		collectIds(navLink, allIds)

		for _, futureId := range futureIds {
			require.False(t, allIds[futureId], "Should not have future item %s", futureId)
		}
	})
}

// Helper function to collect all IDs from navigation tree
func collectIds(navLink *navtree.NavLink, ids map[string]bool) {
	if navLink == nil {
		return
	}
	if navLink.Id != "" {
		ids[navLink.Id] = true
	}
	for _, child := range navLink.Children {
		collectIds(child, ids)
	}
}
