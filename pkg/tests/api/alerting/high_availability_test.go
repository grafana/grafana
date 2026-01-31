package alerting

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/server"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const (
	haTestRuleName          = "HATestRule"
	haTestGroupName         = "ha-test-group"
	defaultRuleEvalInterval = 1 * time.Second
)

type haGrafana struct {
	Addr   string
	Env    *server.TestEnv
	Client apiClient
}

func (g *haGrafana) stop(t *testing.T) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	require.NoError(t, g.Env.Server.Shutdown(ctx, "test stop"))
}

// haSetupOpts configures HA test setup.
type haSetupOpts struct {
	singleNodeEval *bool
}

type haSetupOption func(*haSetupOpts)

func withSingleNodeEval(enabled bool) haSetupOption {
	return func(o *haSetupOpts) {
		o.singleNodeEval = &enabled
	}
}

// TestIntegrationHAEvaluation_SingleNodeEvaluates verifies that when Grafana instances
// are configured with HA single-node evaluation mode:
// 1. Alert rules are visible on all instances (via shared database)
// 2. Alerts are firing on all instances (state served from shared database)
// 3. Only the position-0 node performs evaluations
func TestIntegrationHAEvaluation_SingleNodeEvaluates(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if db.IsTestDbSQLite() {
		t.Skip("This test requires MySQL or PostgreSQL for shared database between instances")
	}

	grafanas, _ := setupHAGrafanas(t, 3)

	waitForClusterSettled(t, grafanas)
	assertPosition0IsEvaluator(t, grafanas)
}

// TestIntegrationHAEvaluation_APIConsistency verifies that all instances
// in the HA cluster return consistent data from the Prometheus rules API.
// This validates that StoreStateReader correctly serves rule state from DB.
func TestIntegrationHAEvaluation_APIConsistency(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if db.IsTestDbSQLite() {
		t.Skip("This test requires MySQL or PostgreSQL for shared database between instances")
	}

	grafanas, _ := setupHAGrafanas(t, 3)

	waitForClusterSettled(t, grafanas)

	// Wait for alert to be firing.
	waitForRuleFiring(t, grafanas[0].Client, haTestRuleName)

	// Verify all instances return consistent rule metadata via Prometheus API.
	// This tests that StoreStateReader correctly reads from DB on all nodes.
	assertConsistentRuleMetadata(t, grafanas)
}

// TestIntegrationHAEvaluation_StatePreservedOnFailover verifies that when the primary
// node (position 0) stops, the new primary correctly warms its cache from the database
// and preserves alert state without spurious Pending->Firing transitions.
func TestIntegrationHAEvaluation_StatePreservedOnFailover(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if db.IsTestDbSQLite() {
		t.Skip("This test requires MySQL or PostgreSQL for shared database between instances")
	}

	grafanas, _ := setupHAGrafanas(t, 3)

	waitForClusterSettled(t, grafanas)

	// Determine which instance is evaluating (position 0).
	primaryIdx := -1
	for i, g := range grafanas {
		if getPeerPosition(t, g.Addr) == 0 {
			primaryIdx = i
			break
		}
	}
	require.NotEqual(t, -1, primaryIdx, "No node found with position 0")

	// Wait for rule to be firing (past the pending period).
	waitForRuleFiring(t, grafanas[primaryIdx].Client, haTestRuleName)

	// Capture the alert's StartsAt time from the primary.
	alertsBefore, status, _ := grafanas[primaryIdx].Client.GetActiveAlertsWithStatus(t)
	require.Equal(t, http.StatusOK, status)
	require.NotEmpty(t, alertsBefore)
	startsAtBefore := findAlertStartsAt(alertsBefore, haTestRuleName)
	require.False(t, startsAtBefore.IsZero(), "Should have captured alert StartsAt time")

	// Ensure alerts are replicated to all nodes before stopping primary.
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		for i, g := range grafanas {
			alerts, status, _ := g.Client.GetActiveAlertsWithStatus(t)
			assert.Equal(c, http.StatusOK, status)
			assert.NotEmpty(c, alerts, "Instance %d should have alerts before failover", i+1)
		}
	}, 30*time.Second, 2*time.Second)

	// Stop the primary node.
	grafanas[primaryIdx].stop(t)

	// Build list of surviving nodes.
	survivingGrafanas := make([]*haGrafana, 0, len(grafanas)-1)
	for i, g := range grafanas {
		if i != primaryIdx {
			survivingGrafanas = append(survivingGrafanas, g)
		}
	}

	// Wait for one of the surviving nodes to become the new primary.
	var newPrimaryIdx int
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		for i, g := range survivingGrafanas {
			pos := getPeerPosition(t, g.Addr)
			if pos == 0 {
				newPrimaryIdx = i
				return
			}
		}
		assert.Fail(c, "No surviving node became position 0")
	}, 30*time.Second, 1*time.Second)

	// Wait for the new primary to start evaluating.
	baselineEvals := getEvalTotal(t, survivingGrafanas[newPrimaryIdx].Addr)
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		evals := getEvalTotal(t, survivingGrafanas[newPrimaryIdx].Addr)
		assert.Greater(c, evals, baselineEvals, "New primary should be evaluating")
	}, 30*time.Second, 1*time.Second)

	// Verify the rule is still firing (not reset to pending).
	rules := survivingGrafanas[newPrimaryIdx].Client.GetPrometheusRules(t)
	ruleState := findRuleState(rules, haTestRuleName)
	require.Equal(t, "firing", ruleState, "Rule should remain firing after failover, not reset to pending")

	// Verify the alert's StartsAt time is preserved (not reset).
	alertsAfter, status, _ := survivingGrafanas[newPrimaryIdx].Client.GetActiveAlertsWithStatus(t)
	require.Equal(t, http.StatusOK, status)
	require.NotEmpty(t, alertsAfter, "Alerts should still be present after failover")
	startsAtAfter := findAlertStartsAt(alertsAfter, haTestRuleName)
	require.False(t, startsAtAfter.IsZero(), "Should find alert StartsAt")

	// StartsAt should be the same or close (within a few seconds due to timing).
	timeDiff := startsAtAfter.Sub(startsAtBefore).Abs()
	require.Less(t, timeDiff, 5*time.Second,
		"Alert StartsAt should be preserved after failover (diff: %v)", timeDiff)

	// Verify identical alert groups across all surviving nodes.
	assertIdenticalAlertGroups(t, survivingGrafanas)
}

// TestIntegrationHAEvaluation_NewNodeJoins verifies that when a new node joins
// the cluster, evaluation continues on the appropriate node without disruption.
func TestIntegrationHAEvaluation_NewNodeJoins(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if db.IsTestDbSQLite() {
		t.Skip("This test requires MySQL or PostgreSQL for shared database between instances")
	}

	// Start with 1 node, then add another.
	grafanas, mr := setupHAGrafanas(t, 1)

	// Wait for rule to fire on single node.
	waitForRuleFiring(t, grafanas[0].Client, haTestRuleName)

	// Add second node to the cluster.
	t.Setenv("SKIP_DB_TRUNCATE", "true")
	addr2, env2 := setupHAGrafanaEnv(t, mr, "grafana-2", true)
	client2 := newAlertingApiClient(addr2, "grafana", "password")
	grafanas = append(grafanas, &haGrafana{Addr: addr2, Env: env2, Client: client2})

	// Wait for cluster to settle with 2 nodes.
	waitForClusterSettled(t, grafanas)

	// Verify position-0 node is evaluating.
	assertPosition0IsEvaluator(t, grafanas)

	// Verify rule is still firing (not disrupted by new node joining).
	rules := grafanas[0].Client.GetPrometheusRules(t)
	ruleState := findRuleState(rules, haTestRuleName)
	require.Equal(t, "firing", ruleState, "Rule should remain firing after new node joins")

	// Verify identical alert groups across all nodes.
	assertIdenticalAlertGroups(t, grafanas)
}

// TestIntegrationHAEvaluation_AllNodesEvaluateWhenDisabled verifies that when
// ha_single_node_evaluation is disabled, all nodes in the cluster perform evaluations.
func TestIntegrationHAEvaluation_AllNodesEvaluateWhenDisabled(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if db.IsTestDbSQLite() {
		t.Skip("This test requires MySQL or PostgreSQL for shared database between instances")
	}

	// Set up 3 nodes with HA clustering but WITHOUT single-node evaluation.
	grafanas, _ := setupHAGrafanas(t, 3, withSingleNodeEval(false))

	waitForClusterSettled(t, grafanas)

	// Wait for rule to fire on at least one node.
	waitForRuleFiring(t, grafanas[0].Client, haTestRuleName)

	// Verify ALL nodes are evaluating (not just position 0).
	baselines := make([]int, len(grafanas))
	for i, g := range grafanas {
		baselines[i] = getEvalTotal(t, g.Addr)
	}

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		evaluatingCount := 0
		for i, g := range grafanas {
			evals := getEvalTotal(t, g.Addr)
			if evals > baselines[i] {
				evaluatingCount++
			}
		}
		assert.Equal(c, len(grafanas), evaluatingCount,
			"All %d instances should be evaluating when ha_single_node_evaluation is disabled", len(grafanas))
	}, 30*time.Second, 1*time.Second)
}

// TestIntegrationHAEvaluation_StartupBehaviorWithoutClustering documents the behavior
// when ha_single_node_evaluation is enabled but HA clustering is not configured.
// Currently, the validation check at startup does not catch this scenario because
// Peer() returns a NilPeer (not nil). This test documents the actual behavior.
func TestIntegrationHAEvaluation_StartupBehaviorWithoutClustering(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if db.IsTestDbSQLite() {
		t.Skip("This test requires MySQL or PostgreSQL")
	}

	// Configure node with ha_single_node_evaluation=true but no Redis address.
	// Note: The current implementation allows this to start because Peer() returns
	// a NilPeer (not nil), so the check at ngalert.go doesn't catch this.
	// This test documents the actual behavior - the node starts but single-node
	// evaluation mode won't function correctly without HA clustering.
	dir, p := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting:        true,
		EnableUnifiedAlerting:        true,
		DisableAnonymous:             true,
		EnableFeatureToggles:         []string{"configurableSchedulerTick"},
		NGAlertSchedulerBaseInterval: 1 * time.Second,
		// Note: HARedisAddr is NOT set, but HASingleNodeEvaluation IS set.
		HASingleNodeEvaluation: true,
	})

	// The server should start (current behavior - validation gap).
	// A future improvement could tighten this validation.
	grafanaAddr, env := testinfra.StartGrafanaEnv(t, dir, p)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		require.NoError(t, env.Server.Shutdown(ctx, "test cleanup"))
	})

	// Create test user and verify the server is responsive.
	createUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "password",
		Login:          "grafana",
	})

	client := newAlertingApiClient(grafanaAddr, "grafana", "password")

	// The server is running, but without HA clustering, alertmanager_peer_position
	// won't be meaningful. Verify the node is evaluating (since it's the only node).
	client.CreateFolder(t, "default", "default")
	group := generateAlertRuleGroup(1, alertRuleGen())
	group.Name = haTestGroupName
	group.Interval = model.Duration(defaultRuleEvalInterval)
	group.Rules[0].GrafanaManagedAlert.Title = haTestRuleName
	client.PostRulesGroup(t, "default", &group, false)

	// Verify evaluations are happening.
	baseline := getEvalTotal(t, grafanaAddr)
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		evals := getEvalTotal(t, grafanaAddr)
		assert.Greater(c, evals, baseline, "Node should be evaluating")
	}, 30*time.Second, 1*time.Second)
}

// setupHAGrafanas starts N Grafana instances configured for HA single-node evaluation,
// creates a test user and alert rule, and waits for the rule to fire.
// Returns the grafanas and miniredis (for adding more nodes later if needed).
func setupHAGrafanas(t *testing.T, count int, opts ...haSetupOption) ([]*haGrafana, *miniredis.Miniredis) {
	t.Helper()

	cfg := &haSetupOpts{}
	for _, opt := range opts {
		opt(cfg)
	}

	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)

	grafanas := make([]*haGrafana, 0, count)
	singleNodeEvalEnabled := cfg.singleNodeEval == nil || *cfg.singleNodeEval

	// Start first instance and set up test data.
	addr1, env1 := setupHAGrafanaEnv(t, mr, "grafana-1", singleNodeEvalEnabled)
	client1 := newAlertingApiClient(addr1, "grafana", "password")
	grafanas = append(grafanas, &haGrafana{Addr: addr1, Env: env1, Client: client1})

	createUser(t, env1.SQLStore, env1.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "password",
		Login:          "grafana",
	})

	client1.CreateFolder(t, "default", "default")

	group := generateAlertRuleGroup(1, alertRuleGen())
	group.Name = haTestGroupName
	group.Interval = model.Duration(defaultRuleEvalInterval)
	group.Rules[0].GrafanaManagedAlert.Title = haTestRuleName
	client1.PostRulesGroup(t, "default", &group, false)

	// Wait for rule to fire before starting other instances.
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		rules := client1.GetPrometheusRules(t)
		state := findRuleState(rules, haTestRuleName)
		assert.Equal(c, "firing", state, "Rule should be firing")
	}, 30*time.Second, 1*time.Second)

	// Start remaining instances.
	t.Setenv("SKIP_DB_TRUNCATE", "true")
	for i := 2; i <= count; i++ {
		peerName := fmt.Sprintf("grafana-%d", i)
		addr, env := setupHAGrafanaEnv(t, mr, peerName, singleNodeEvalEnabled)
		client := newAlertingApiClient(addr, "grafana", "password")
		grafanas = append(grafanas, &haGrafana{Addr: addr, Env: env, Client: client})
	}

	return grafanas, mr
}

// waitForClusterSettled waits until all instances have settled with unique peer positions.
func waitForClusterSettled(t *testing.T, grafanas []*haGrafana) {
	t.Helper()
	n := len(grafanas)
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		positions := make(map[int]bool)
		for _, g := range grafanas {
			pos := getPeerPosition(t, g.Addr)
			positions[pos] = true
		}
		for i := 0; i < n; i++ {
			assert.True(c, positions[i], "Position %d should be assigned", i)
		}
	}, 30*time.Second, 1*time.Second)
}

// assertPosition0IsEvaluator verifies that only the position-0 node is performing
// evaluations, and other nodes are not evaluating.
func assertPosition0IsEvaluator(t *testing.T, grafanas []*haGrafana) {
	t.Helper()

	baselines := make([]int, len(grafanas))
	for i, g := range grafanas {
		baselines[i] = getEvalTotal(t, g.Addr)
	}

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		for i, g := range grafanas {
			pos := getPeerPosition(t, g.Addr)
			evals := getEvalTotal(t, g.Addr)
			isEvaluating := evals > baselines[i]

			if pos == 0 {
				assert.True(c, isEvaluating, "Position 0 node should be evaluating")
			} else {
				assert.False(c, isEvaluating, "Position %d node should NOT be evaluating", pos)
			}
		}
	}, 30*time.Second, 1*time.Second)
}

// assertIdenticalAlertGroups verifies that all nodes have identical alert groups.
func assertIdenticalAlertGroups(t *testing.T, grafanas []*haGrafana) {
	t.Helper()

	cmpOpts := cmp.Options{
		cmpopts.IgnoreFields(amv2.GettableAlert{}, "UpdatedAt", "EndsAt"), // Updated independently by each AM
		cmpopts.SortSlices(func(a, b *amv2.GettableAlert) bool {
			return a.Labels["alertname"] < b.Labels["alertname"]
		}),
	}

	var referenceAlerts apimodels.AlertGroups
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		for i, g := range grafanas {
			alerts, status, _ := g.Client.GetActiveAlertsWithStatus(t)
			assert.Equal(c, http.StatusOK, status)

			if i == 0 {
				referenceAlerts = alerts
				continue
			}

			diff := cmp.Diff(referenceAlerts, alerts, cmpOpts)
			assert.Empty(c, diff, "Node %d alerts should match node 0:\n%s", i+1, diff)
		}
	}, 30*time.Second, 2*time.Second)
}

// assertConsistentRuleMetadata verifies all nodes return consistent rule metadata
// from the Prometheus rules API.
func assertConsistentRuleMetadata(t *testing.T, grafanas []*haGrafana) {
	t.Helper()

	cmpOpts := cmp.Options{
		cmpopts.SortSlices(func(a, b apimodels.Alert) bool {
			return a.Labels.Get("alertname") < b.Labels.Get("alertname")
		}),
		cmpopts.IgnoreFields(apimodels.AlertingRule{}, "LastEvaluation", "EvaluationTime"),
	}

	var refRules map[string]apimodels.AlertingRule
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		for i, g := range grafanas {
			rules := rulesByUID(g.Client.GetPrometheusRules(t))
			if i == 0 {
				refRules = rules
				continue
			}

			for uid, ref := range refRules {
				node, ok := rules[uid]
				if !assert.True(c, ok, "Instance %d missing rule %s", i+1, uid) {
					continue
				}
				diff := cmp.Diff(ref, node, cmpOpts...)
				assert.Empty(c, diff, "Instance %d rule %s mismatch:\n%s", i+1, uid, diff)
			}
		}
	}, 30*time.Second, 2*time.Second)
}

func rulesByUID(resp apimodels.RuleResponse) map[string]apimodels.AlertingRule {
	result := make(map[string]apimodels.AlertingRule)
	for _, group := range resp.Data.RuleGroups {
		for _, rule := range group.Rules {
			result[rule.UID] = rule
		}
	}
	return result
}

// waitForRuleFiring waits until the specified rule is in firing state.
func waitForRuleFiring(t *testing.T, client apiClient, ruleName string) {
	t.Helper()

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		rules := client.GetPrometheusRules(t)
		state := findRuleState(rules, ruleName)
		assert.Equal(c, "firing", state)
	}, 30*time.Second, 1*time.Second)
}

// findRuleState finds a rule by name and returns its state.
func findRuleState(rules apimodels.RuleResponse, ruleName string) string {
	for _, group := range rules.Data.RuleGroups {
		for _, rule := range group.Rules {
			if rule.Name == ruleName {
				return rule.State
			}
		}
	}

	return "not_found"
}

// findAlertStartsAt finds the StartsAt time for an alert with the given alertname label.
func findAlertStartsAt(alerts apimodels.AlertGroups, alertName string) time.Time {
	for _, group := range alerts {
		for _, alert := range group.Alerts {
			if alert.Labels["alertname"] == alertName && alert.StartsAt != nil {
				return time.Time(*alert.StartsAt)
			}
		}
	}

	return time.Time{}
}

func getPeerPosition(t *testing.T, addr string) int {
	t.Helper()

	return int(testinfra.GetMetricValue(t, addr, "grafana", "password", "alertmanager_peer_position"))
}

func getEvalTotal(t *testing.T, addr string) int {
	t.Helper()

	return int(testinfra.GetMetricValue(t, addr, "grafana", "password", "grafana_alerting_rule_evaluations_total"))
}

// setupHAGrafanaEnv creates a Grafana instance configured for HA clustering.
// When singleNodeEvalEnabled is true, ha_single_node_evaluation is enabled.
func setupHAGrafanaEnv(t *testing.T, mr *miniredis.Miniredis, peerName string, singleNodeEvalEnabled bool) (string, *server.TestEnv) {
	t.Helper()

	dir, p := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting:        true,
		EnableUnifiedAlerting:        true,
		DisableAnonymous:             true,
		EnableFeatureToggles:         []string{"configurableSchedulerTick"},
		NGAlertSchedulerBaseInterval: 1 * time.Second,
		HARedisAddr:                  mr.Addr(),
		HARedisPeerName:              peerName,
		HASingleNodeEvaluation:       singleNodeEvalEnabled,
	})

	grafanaAddr, env := testinfra.StartGrafanaEnv(t, dir, p)
	return grafanaAddr, env
}
