package authz

import (
	"context"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestRolloutBucket_Determinism(t *testing.T) {
	namespaces := []string{"stacks-1", "stacks-100", "stacks-999", "org-42", "default"}
	for _, ns := range namespaces {
		b1 := rolloutBucket(ns, "dashboard.grafana.app", "dashboards")
		b2 := rolloutBucket(ns, "dashboard.grafana.app", "dashboards")
		assert.Equal(t, b1, b2, "rolloutBucket must return the same value for namespace %s", ns)
	}
}

func TestRolloutBucket_Range(t *testing.T) {
	b := rolloutBucket("stacks-100", "dashboard.grafana.app", "dashboards")
	assert.GreaterOrEqual(t, b, 0.0)
	assert.Less(t, b, 1.0)
}

func TestRolloutBucket_PerResourceIndependence(t *testing.T) {
	namespaces := []string{
		"stacks-1", "stacks-2", "stacks-3", "stacks-4", "stacks-5",
		"stacks-6", "stacks-7", "stacks-8", "stacks-9", "stacks-10",
	}

	diffCount := 0
	for _, ns := range namespaces {
		dashBucket := rolloutBucket(ns, "dashboard.grafana.app", "dashboards")
		folderBucket := rolloutBucket(ns, "folder.grafana.app", "folders")
		if dashBucket != folderBucket {
			diffCount++
		}
	}
	assert.Greater(t, diffCount, 0, "expected at least one namespace to route differently between the two resources")
}

func TestRolloutAccessClient_RoutesCorrectly(t *testing.T) {
	// rbacClient returns allowed=true; zanzanaClient returns allowed=false.
	// We distinguish which client was used by checking the result.
	rbacClient := authlib.FixedAccessClient(true)
	zanzanaClient := authlib.FixedAccessClient(false)

	client := newRolloutAccessClient(rbacClient, zanzanaClient, map[string]float64{
		"dashboard.grafana.app/dashboards": 0.5,
	})

	for _, ns := range []string{"stacks-1", "stacks-2", "stacks-3", "stacks-10", "stacks-50"} {
		req := authlib.CheckRequest{
			Group:     "dashboard.grafana.app",
			Resource:  "dashboards",
			Namespace: ns,
			Verb:      utils.VerbGet,
		}
		bucket := rolloutBucket(ns, "dashboard.grafana.app", "dashboards")
		expectedZanzana := bucket < 0.5

		resp, err := client.Check(context.Background(), &identity.StaticRequester{Namespace: ns}, req, "")
		require.NoError(t, err)
		if expectedZanzana {
			assert.False(t, resp.Allowed, "ns=%s (bucket=%.4f) should route to zanzana", ns, bucket)
		} else {
			assert.True(t, resp.Allowed, "ns=%s (bucket=%.4f) should route to rbac", ns, bucket)
		}
	}
}

func TestRolloutAccessClient_ZeroPercent(t *testing.T) {
	rbacClient := authlib.FixedAccessClient(true)
	zanzanaClient := authlib.FixedAccessClient(false)
	client := newRolloutAccessClient(rbacClient, zanzanaClient, map[string]float64{
		"dashboard.grafana.app/dashboards": 0.0,
	})

	for _, ns := range []string{"stacks-1", "stacks-50", "stacks-99"} {
		req := authlib.CheckRequest{
			Group:     "dashboard.grafana.app",
			Resource:  "dashboards",
			Namespace: ns,
			Verb:      utils.VerbGet,
		}
		resp, err := client.Check(context.Background(), &identity.StaticRequester{Namespace: ns}, req, "")
		require.NoError(t, err)
		assert.True(t, resp.Allowed, "0%% rollout should always use RBAC for ns=%s", ns)
	}
}

func TestRolloutAccessClient_HundredPercent(t *testing.T) {
	rbacClient := authlib.FixedAccessClient(true)
	zanzanaClient := authlib.FixedAccessClient(false)
	client := newRolloutAccessClient(rbacClient, zanzanaClient, map[string]float64{
		"dashboard.grafana.app/dashboards": 1.0,
	})

	for _, ns := range []string{"stacks-1", "stacks-50", "stacks-99"} {
		req := authlib.CheckRequest{
			Group:     "dashboard.grafana.app",
			Resource:  "dashboards",
			Namespace: ns,
			Verb:      utils.VerbGet,
		}
		resp, err := client.Check(context.Background(), &identity.StaticRequester{Namespace: ns}, req, "")
		require.NoError(t, err)
		assert.False(t, resp.Allowed, "100%% rollout should always use Zanzana for ns=%s", ns)
	}
}

func TestRolloutAccessClient_ResourceNotInRollout(t *testing.T) {
	rbacClient := authlib.FixedAccessClient(true)
	zanzanaClient := authlib.FixedAccessClient(false)
	client := newRolloutAccessClient(rbacClient, zanzanaClient, map[string]float64{
		"dashboard.grafana.app/dashboards": 0.5,
	})

	req := authlib.CheckRequest{
		Group:     "folder.grafana.app",
		Resource:  "folders",
		Namespace: "stacks-1",
		Verb:      utils.VerbGet,
	}
	resp, err := client.Check(context.Background(), &identity.StaticRequester{Namespace: "stacks-1"}, req, "")
	require.NoError(t, err)
	assert.True(t, resp.Allowed, "resource not in rollout map should always use RBAC")
}

//nolint:staticcheck // SA1019: Compile is deprecated but still exercised here until BatchCheck is fully implemented
func TestRolloutAccessClient_Compile(t *testing.T) {
	rbacClient := authlib.FixedAccessClient(true)
	zanzanaClient := authlib.FixedAccessClient(false)

	t.Run("routes to zanzana at 100%", func(t *testing.T) {
		client := newRolloutAccessClient(rbacClient, zanzanaClient, map[string]float64{
			"dashboard.grafana.app/dashboards": 1.0,
		})
		req := authlib.ListRequest{
			Group:     "dashboard.grafana.app",
			Resource:  "dashboards",
			Namespace: "stacks-1",
			Verb:      utils.VerbGet,
		}
		checker, _, err := client.Compile(context.Background(), &identity.StaticRequester{Namespace: "stacks-1"}, req)
		require.NoError(t, err)
		require.NotNil(t, checker)
		assert.False(t, checker("dash-uid", ""), "100%% rollout should route Compile to Zanzana (not allowed)")
	})

	t.Run("routes to rbac at 0%", func(t *testing.T) {
		client := newRolloutAccessClient(rbacClient, zanzanaClient, map[string]float64{
			"dashboard.grafana.app/dashboards": 0.0,
		})
		req := authlib.ListRequest{
			Group:     "dashboard.grafana.app",
			Resource:  "dashboards",
			Namespace: "stacks-1",
			Verb:      utils.VerbGet,
		}
		checker, _, err := client.Compile(context.Background(), &identity.StaticRequester{Namespace: "stacks-1"}, req)
		require.NoError(t, err)
		require.NotNil(t, checker)
		assert.True(t, checker("dash-uid", ""), "0%% rollout should route Compile to RBAC (allowed)")
	})
}

func TestRolloutAccessClient_BatchCheck(t *testing.T) {
	rbacClient := authlib.FixedAccessClient(true)
	zanzanaClient := authlib.FixedAccessClient(false)

	t.Run("routes to zanzana at 100%", func(t *testing.T) {
		client := newRolloutAccessClient(rbacClient, zanzanaClient, map[string]float64{
			"dashboard.grafana.app/dashboards": 1.0,
		})
		req := authlib.BatchCheckRequest{
			Namespace: "stacks-1",
			Checks: []authlib.BatchCheckItem{
				{CorrelationID: "1", Group: "dashboard.grafana.app", Resource: "dashboards", Verb: utils.VerbGet, Name: "d1"},
				{CorrelationID: "2", Group: "dashboard.grafana.app", Resource: "dashboards", Verb: utils.VerbGet, Name: "d2"},
			},
		}
		resp, err := client.BatchCheck(context.Background(), &identity.StaticRequester{Namespace: "stacks-1"}, req)
		require.NoError(t, err)
		assert.False(t, resp.Results["1"].Allowed, "100%% rollout should route BatchCheck to Zanzana")
		assert.False(t, resp.Results["2"].Allowed, "100%% rollout should route BatchCheck to Zanzana")
	})

	t.Run("routes to rbac for resource not in rollout", func(t *testing.T) {
		client := newRolloutAccessClient(rbacClient, zanzanaClient, map[string]float64{
			"dashboard.grafana.app/dashboards": 1.0,
		})
		req := authlib.BatchCheckRequest{
			Namespace: "stacks-1",
			Checks: []authlib.BatchCheckItem{
				{CorrelationID: "1", Group: "folder.grafana.app", Resource: "folders", Verb: utils.VerbGet, Name: "f1"},
			},
		}
		resp, err := client.BatchCheck(context.Background(), &identity.StaticRequester{Namespace: "stacks-1"}, req)
		require.NoError(t, err)
		assert.True(t, resp.Results["1"].Allowed, "resource not in rollout should route BatchCheck to RBAC")
	})

	t.Run("empty batch routes to rbac", func(t *testing.T) {
		client := newRolloutAccessClient(rbacClient, zanzanaClient, map[string]float64{
			"dashboard.grafana.app/dashboards": 1.0,
		})
		resp, err := client.BatchCheck(context.Background(), &identity.StaticRequester{Namespace: "stacks-1"}, authlib.BatchCheckRequest{Namespace: "stacks-1"})
		require.NoError(t, err)
		assert.Empty(t, resp.Results)
	})

	t.Run("mixed group/resource falls back to rbac", func(t *testing.T) {
		client := newRolloutAccessClient(rbacClient, zanzanaClient, map[string]float64{
			"dashboard.grafana.app/dashboards": 1.0,
		})
		req := authlib.BatchCheckRequest{
			Namespace: "stacks-1",
			Checks: []authlib.BatchCheckItem{
				{CorrelationID: "1", Group: "dashboard.grafana.app", Resource: "dashboards", Verb: utils.VerbGet},
				{CorrelationID: "2", Group: "folder.grafana.app", Resource: "folders", Verb: utils.VerbGet},
			},
		}
		resp, err := client.BatchCheck(context.Background(), &identity.StaticRequester{Namespace: "stacks-1"}, req)
		require.NoError(t, err)
		assert.True(t, resp.Results["1"].Allowed, "mixed-resource batch should fall back to RBAC (allowed)")
		assert.True(t, resp.Results["2"].Allowed, "mixed-resource batch should fall back to RBAC (allowed)")
	})
}
