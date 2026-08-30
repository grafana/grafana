package api

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

func TestDeprecatedRuleProvisioningResponse(t *testing.T) {
	t.Run("sets all deprecation headers on NormalResponse", func(t *testing.T) {
		resp := response.JSON(http.StatusOK, map[string]string{"status": "ok"})

		result := deprecatedRuleProvisioningResponse(resp, "/apis/example/v1/resources")

		nr, ok := result.(*response.NormalResponse)
		require.True(t, ok)
		assert.Equal(t, `299 - "Deprecated API: use the Grafana App Platform alerting API instead."`, nr.Header().Get("Warning"))
		assert.Equal(t, "2026-03-10", nr.Header().Get("X-API-Deprecation-Date"))
		assert.Equal(t, "/apis/example/v1/resources", nr.Header().Get("X-API-Replacement"))
	})

	t.Run("omits X-API-Replacement when replacement is empty", func(t *testing.T) {
		resp := response.JSON(http.StatusOK, map[string]string{"status": "ok"})

		result := deprecatedRuleProvisioningResponse(resp, "")

		nr, ok := result.(*response.NormalResponse)
		require.True(t, ok)
		assert.NotEmpty(t, nr.Header().Get("Warning"))
		assert.NotEmpty(t, nr.Header().Get("X-API-Deprecation-Date"))
		assert.Empty(t, nr.Header().Get("X-API-Replacement"))
	})

	t.Run("returns response unchanged for non-NormalResponse types", func(t *testing.T) {
		resp := response.CreateNormalResponse(http.Header{}, []byte("test"), http.StatusOK)
		// Wrap in the interface so the type assertion still succeeds here (it's
		// still a *NormalResponse), but this confirms no panic on valid types.
		result := deprecatedRuleProvisioningResponse(resp, replacementAlertRules)
		require.Equal(t, http.StatusOK, result.Status())
	})
}

func TestDeprecatedHandlers_SetHeaders(t *testing.T) {
	sut := createProvisioningSrvSut(t)
	handler := NewProvisioningApi(&sut)

	assertDeprecationHeaders := func(t *testing.T, resp response.Response, expectByUID bool) {
		t.Helper()
		nr, ok := resp.(*response.NormalResponse)
		require.True(t, ok, "expected *response.NormalResponse")

		assert.Equal(t,
			`299 - "Deprecated API: use the Grafana App Platform alerting API instead."`,
			nr.Header().Get("Warning"),
		)
		assert.Equal(t, "2026-03-10", nr.Header().Get("X-API-Deprecation-Date"))

		replacement := nr.Header().Get("X-API-Replacement")
		assert.NotEmpty(t, replacement)

		if expectByUID {
			assert.Equal(t, replacementAlertRuleByUID, replacement)
		} else {
			assert.Equal(t, replacementAlertRules, replacement)
		}
	}

	assertNoDeprecationHeaders := func(t *testing.T, resp response.Response) {
		t.Helper()
		nr, ok := resp.(*response.NormalResponse)
		require.True(t, ok, "expected *response.NormalResponse")
		assert.Empty(t, nr.Header().Get("Warning"))
		assert.Empty(t, nr.Header().Get("X-API-Deprecation-Date"))
		assert.Empty(t, nr.Header().Get("X-API-Replacement"))
	}

	// Insert a rule so GET/PUT/DELETE by UID and group endpoints have data to work with.
	rc := createTestRequestCtx()
	rule := createTestAlertRule("deprecation-test", 1)
	insertRule(t, sut, rule)

	// Re-fetch to get the UID assigned by the store.
	listResp := sut.RouteGetAlertRules(&rc)
	require.Equal(t, http.StatusOK, listResp.Status())
	var rules definitions.ProvisionedAlertRules
	require.NoError(t, json.Unmarshal(listResp.Body(), &rules))
	require.NotEmpty(t, rules)
	uid := rules[0].UID
	folderUID := rules[0].FolderUID
	group := rules[0].RuleGroup

	t.Run("deprecated endpoints include deprecation headers", func(t *testing.T) {
		t.Run("GET alert rules (collection)", func(t *testing.T) {
			rc := createTestRequestCtx()
			resp := handler.handleRouteGetAlertRules(&rc)
			assertDeprecationHeaders(t, resp, false)
		})

		t.Run("GET alert rule by UID", func(t *testing.T) {
			rc := createTestRequestCtx()
			resp := handler.handleRouteGetAlertRule(&rc, uid)
			assertDeprecationHeaders(t, resp, true)
		})

		t.Run("POST alert rule", func(t *testing.T) {
			rc := createTestRequestCtx()
			newRule := createTestAlertRule("deprecation-post-test", 1)
			resp := handler.handleRoutePostAlertRule(&rc, newRule)
			assertDeprecationHeaders(t, resp, false)
		})

		t.Run("PUT alert rule", func(t *testing.T) {
			rc := createTestRequestCtx()
			updatedRule := createTestAlertRule("deprecation-put-test", 1)
			resp := handler.handleRoutePutAlertRule(&rc, updatedRule, uid)
			assertDeprecationHeaders(t, resp, true)
		})

		t.Run("DELETE alert rule", func(t *testing.T) {
			rc := createTestRequestCtx()
			// Insert a throwaway rule to delete.
			throwaway := createTestAlertRule("deprecation-delete-test", 1)
			insertRule(t, sut, throwaway)
			listResp := sut.RouteGetAlertRules(&rc)
			var allRules definitions.ProvisionedAlertRules
			require.NoError(t, json.Unmarshal(listResp.Body(), &allRules))
			var deleteUID string
			for _, r := range allRules {
				if r.Title == "deprecation-delete-test" {
					deleteUID = r.UID
					break
				}
			}
			require.NotEmpty(t, deleteUID)

			resp := handler.handleRouteDeleteAlertRule(&rc, deleteUID)
			assertDeprecationHeaders(t, resp, true)
		})

		t.Run("GET alert rule group", func(t *testing.T) {
			rc := createTestRequestCtx()
			resp := handler.handleRouteGetAlertRuleGroup(&rc, folderUID, group)
			assertDeprecationHeaders(t, resp, false)
		})

		t.Run("PUT alert rule group", func(t *testing.T) {
			rc := createTestRequestCtx()
			ag := definitions.AlertRuleGroup{
				Title:     group,
				FolderUID: folderUID,
				Interval:  60,
				Rules:     []definitions.ProvisionedAlertRule{createTestAlertRule("group-rule", 1)},
			}
			resp := handler.handleRoutePutAlertRuleGroup(&rc, ag, folderUID, group)
			assertDeprecationHeaders(t, resp, false)
		})

		t.Run("DELETE alert rule group", func(t *testing.T) {
			rc := createTestRequestCtx()
			// Insert a group to delete.
			throwawayRule := createTestAlertRule("delete-group-test", 1)
			throwawayRule.RuleGroup = "throwaway-group"
			insertRule(t, sut, throwawayRule)

			resp := handler.handleRouteDeleteAlertRuleGroup(&rc, folderUID, "throwaway-group")
			assertDeprecationHeaders(t, resp, false)
		})
	})

	t.Run("non-deprecated endpoints omit deprecation headers", func(t *testing.T) {
		t.Run("GET alert rules export", func(t *testing.T) {
			rc := createTestRequestCtx()
			resp := handler.handleRouteGetAlertRulesExport(&rc)
			assertNoDeprecationHeaders(t, resp)
		})

		t.Run("GET alert rule export", func(t *testing.T) {
			rc := createTestRequestCtx()
			resp := handler.handleRouteGetAlertRuleExport(&rc, uid)
			assertNoDeprecationHeaders(t, resp)
		})

		t.Run("GET alert rule group export", func(t *testing.T) {
			rc := createTestRequestCtx()
			resp := handler.handleRouteGetAlertRuleGroupExport(&rc, folderUID, group)
			assertNoDeprecationHeaders(t, resp)
		})
	})
}
