package authz

import (
	"context"
	"errors"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type recordingBatchAccessClient struct {
	authlib.AccessClient
	allowed bool
	calls   []authlib.BatchCheckRequest
	err     error
	results map[string]authlib.BatchCheckResult
}

func (c *recordingBatchAccessClient) BatchCheck(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	c.calls = append(c.calls, req)
	if c.err != nil {
		return authlib.BatchCheckResponse{}, c.err
	}
	results := make(map[string]authlib.BatchCheckResult, len(req.Checks))
	for _, check := range req.Checks {
		if result, ok := c.results[check.CorrelationID]; ok {
			results[check.CorrelationID] = result
			continue
		}
		results[check.CorrelationID] = authlib.BatchCheckResult{Allowed: c.allowed}
	}
	return authlib.BatchCheckResponse{Results: results}, nil
}

func TestRolloutBucket_Determinism(t *testing.T) {
	namespaces := []string{"stacks-1", "stacks-100", "stacks-999", "org-42", "default"}
	for _, ns := range namespaces {
		b1 := rolloutBucket(ns, "dashboard.grafana.app/dashboards")
		b2 := rolloutBucket(ns, "dashboard.grafana.app/dashboards")
		assert.Equal(t, b1, b2, "rolloutBucket must return the same value for namespace %s", ns)
	}
}

func TestRolloutBucket_Range(t *testing.T) {
	b := rolloutBucket("stacks-100", "dashboard.grafana.app/dashboards")
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
		dashBucket := rolloutBucket(ns, "dashboard.grafana.app/dashboards")
		folderBucket := rolloutBucket(ns, "folder.grafana.app/folders")
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
		bucket := rolloutBucket(ns, "dashboard.grafana.app/dashboards")
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

func TestRolloutAccessClient_Subresource(t *testing.T) {
	rbacClient := authlib.FixedAccessClient(true)
	zanzanaClient := authlib.FixedAccessClient(false)

	t.Run("subresource is not covered by its parent resource", func(t *testing.T) {
		// Zanzana only holds tuples for the actions its reconciler translates,
		// and annotations are not among them. Rolling out dashboards must not
		// drag the annotations subresource along with it.
		client := newRolloutAccessClient(rbacClient, zanzanaClient, map[string]float64{
			"dashboard.grafana.app/dashboards": 1.0,
		})
		req := authlib.CheckRequest{
			Group:       "dashboard.grafana.app",
			Resource:    "dashboards",
			Subresource: "annotations",
			Namespace:   "stacks-1",
			Verb:        utils.VerbGet,
		}
		resp, err := client.Check(context.Background(), &identity.StaticRequester{Namespace: "stacks-1"}, req, "")
		require.NoError(t, err)
		assert.True(t, resp.Allowed, "subresource absent from the rollout map should use RBAC")
	})

	t.Run("subresource routes to zanzana when rolled out explicitly", func(t *testing.T) {
		client := newRolloutAccessClient(rbacClient, zanzanaClient, map[string]float64{
			"dashboard.grafana.app/dashboards/annotations": 1.0,
		})
		req := authlib.CheckRequest{
			Group:       "dashboard.grafana.app",
			Resource:    "dashboards",
			Subresource: "annotations",
			Namespace:   "stacks-1",
			Verb:        utils.VerbGet,
		}
		resp, err := client.Check(context.Background(), &identity.StaticRequester{Namespace: "stacks-1"}, req, "")
		require.NoError(t, err)
		assert.False(t, resp.Allowed, "explicitly rolled out subresource should use Zanzana")
	})

	t.Run("rolling out a subresource does not affect its parent", func(t *testing.T) {
		client := newRolloutAccessClient(rbacClient, zanzanaClient, map[string]float64{
			"dashboard.grafana.app/dashboards/annotations": 1.0,
		})
		req := authlib.CheckRequest{
			Group:     "dashboard.grafana.app",
			Resource:  "dashboards",
			Namespace: "stacks-1",
			Verb:      utils.VerbGet,
		}
		resp, err := client.Check(context.Background(), &identity.StaticRequester{Namespace: "stacks-1"}, req, "")
		require.NoError(t, err)
		assert.True(t, resp.Allowed, "parent resource absent from the rollout map should use RBAC")
	})

	t.Run("BatchCheck keeps subresource items on RBAC", func(t *testing.T) {
		client := newRolloutAccessClient(rbacClient, zanzanaClient, map[string]float64{
			"dashboard.grafana.app/dashboards": 1.0,
		})
		req := authlib.BatchCheckRequest{
			Namespace: "stacks-1",
			Checks: []authlib.BatchCheckItem{
				{CorrelationID: "1", Group: "dashboard.grafana.app", Resource: "dashboards", Subresource: "annotations", Verb: utils.VerbGet},
				{CorrelationID: "2", Group: "dashboard.grafana.app", Resource: "dashboards", Subresource: "annotations", Verb: utils.VerbCreate},
			},
		}
		resp, err := client.BatchCheck(context.Background(), &identity.StaticRequester{Namespace: "stacks-1"}, req)
		require.NoError(t, err)
		assert.True(t, resp.Results["1"].Allowed, "subresource batch should route to RBAC")
		assert.True(t, resp.Results["2"].Allowed, "subresource batch should route to RBAC")
	})

	t.Run("BatchCheck routes mixed subresources individually", func(t *testing.T) {
		client := newRolloutAccessClient(rbacClient, zanzanaClient, map[string]float64{
			"dashboard.grafana.app/dashboards": 1.0,
		})
		req := authlib.BatchCheckRequest{
			Namespace: "stacks-1",
			Checks: []authlib.BatchCheckItem{
				{CorrelationID: "1", Group: "dashboard.grafana.app", Resource: "dashboards", Verb: utils.VerbGet},
				{CorrelationID: "2", Group: "dashboard.grafana.app", Resource: "dashboards", Subresource: "annotations", Verb: utils.VerbGet},
			},
		}
		resp, err := client.BatchCheck(context.Background(), &identity.StaticRequester{Namespace: "stacks-1"}, req)
		require.NoError(t, err)
		assert.False(t, resp.Results["1"].Allowed, "rolled out parent resource should use Zanzana")
		assert.True(t, resp.Results["2"].Allowed, "subresource without a rollout entry should use RBAC")
	})
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

	t.Run("mixed group/resource routes each check", func(t *testing.T) {
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
		assert.False(t, resp.Results["1"].Allowed, "rolled out datasource should use Zanzana")
		assert.True(t, resp.Results["2"].Allowed, "mixed-resource batch should fall back to RBAC (allowed)")
	})
}

func TestRolloutAccessClient_BatchCheckPartitionsByRolloutRoute(t *testing.T) {
	rbacFailure := errors.New("RBAC unavailable")

	t.Run("mixed routes preserve results and request options", func(t *testing.T) {
		rbacClient := &recordingBatchAccessClient{allowed: true}
		zanzanaClient := &recordingBatchAccessClient{allowed: false, results: map[string]authlib.BatchCheckResult{
			"item-error": {Error: errors.New("per-item failure")},
		}}
		client := newRolloutAccessClient(rbacClient, zanzanaClient, map[string]float64{
			"dashboard.grafana.app/dashboards": 1,
		})
		req := authlib.BatchCheckRequest{
			Namespace: "stacks-1",
			SkipCache: true,
			Checks: []authlib.BatchCheckItem{
				{CorrelationID: "zanzana", Group: "dashboard.grafana.app", Resource: "dashboards", Verb: utils.VerbGet},
				{CorrelationID: "rbac", Group: "dashboard.grafana.app", Resource: "dashboards", Subresource: "annotations", Verb: utils.VerbGet},
				{CorrelationID: "item-error", Group: "dashboard.grafana.app", Resource: "dashboards", Verb: utils.VerbUpdate},
			},
		}

		resp, err := client.BatchCheck(context.Background(), &identity.StaticRequester{Namespace: "stacks-1"}, req)
		require.NoError(t, err)
		require.Len(t, rbacClient.calls, 1)
		require.Len(t, zanzanaClient.calls, 1)
		assert.Equal(t, "stacks-1", rbacClient.calls[0].Namespace)
		assert.True(t, rbacClient.calls[0].SkipCache)
		assert.Equal(t, []string{"rbac"}, correlationIDs(rbacClient.calls[0].Checks))
		assert.Equal(t, []string{"zanzana", "item-error"}, correlationIDs(zanzanaClient.calls[0].Checks))
		assert.False(t, resp.Results["zanzana"].Allowed)
		assert.True(t, resp.Results["rbac"].Allowed)
		assert.Error(t, resp.Results["item-error"].Error)
	})

	t.Run("one selected backend receives one batch", func(t *testing.T) {
		rbacClient := &recordingBatchAccessClient{allowed: true}
		zanzanaClient := &recordingBatchAccessClient{allowed: false}
		client := newRolloutAccessClient(rbacClient, zanzanaClient, nil)
		req := authlib.BatchCheckRequest{Namespace: "stacks-1", Checks: []authlib.BatchCheckItem{
			{CorrelationID: "one", Group: "dashboard.grafana.app", Resource: "dashboards", Verb: utils.VerbGet},
			{CorrelationID: "two", Group: "folder.grafana.app", Resource: "folders", Verb: utils.VerbGet},
		}}

		resp, err := client.BatchCheck(context.Background(), &identity.StaticRequester{Namespace: "stacks-1"}, req)
		require.NoError(t, err)
		require.Len(t, rbacClient.calls, 1)
		assert.Empty(t, zanzanaClient.calls)
		assert.True(t, resp.Results["one"].Allowed)
		assert.True(t, resp.Results["two"].Allowed)
	})

	t.Run("validates duplicate correlation IDs before partitioning", func(t *testing.T) {
		rbacClient := &recordingBatchAccessClient{allowed: true}
		zanzanaClient := &recordingBatchAccessClient{allowed: false}
		client := newRolloutAccessClient(rbacClient, zanzanaClient, map[string]float64{
			"dashboard.grafana.app/dashboards": 1,
		})
		req := authlib.BatchCheckRequest{Namespace: "stacks-1", Checks: []authlib.BatchCheckItem{
			{CorrelationID: "same", Group: "dashboard.grafana.app", Resource: "dashboards", Verb: utils.VerbGet},
			{CorrelationID: "same", Group: "dashboard.grafana.app", Resource: "dashboards", Subresource: "annotations", Verb: utils.VerbGet},
		}}

		_, err := client.BatchCheck(context.Background(), &identity.StaticRequester{Namespace: "stacks-1"}, req)
		require.Error(t, err)
		assert.Empty(t, rbacClient.calls)
		assert.Empty(t, zanzanaClient.calls)
	})

	t.Run("returns backend errors", func(t *testing.T) {
		rbacClient := &recordingBatchAccessClient{allowed: true, err: rbacFailure}
		zanzanaClient := &recordingBatchAccessClient{allowed: false}
		client := newRolloutAccessClient(rbacClient, zanzanaClient, map[string]float64{
			"dashboard.grafana.app/dashboards": 1,
		})
		req := authlib.BatchCheckRequest{Namespace: "stacks-1", Checks: []authlib.BatchCheckItem{
			{CorrelationID: "z", Group: "dashboard.grafana.app", Resource: "dashboards", Verb: utils.VerbGet},
			{CorrelationID: "r", Group: "folder.grafana.app", Resource: "folders", Verb: utils.VerbGet},
		}}

		_, err := client.BatchCheck(context.Background(), &identity.StaticRequester{Namespace: "stacks-1"}, req)
		require.ErrorIs(t, err, rbacFailure)
		assert.Len(t, rbacClient.calls, 1)
		assert.Empty(t, zanzanaClient.calls)
	})
}

func correlationIDs(checks []authlib.BatchCheckItem) []string {
	ids := make([]string, len(checks))
	for i, check := range checks {
		ids[i] = check.CorrelationID
	}
	return ids
}

func TestRolloutDatasourceAliasesShareBatchRoute(t *testing.T) {
	client := newRolloutAccessClient(authlib.FixedAccessClient(true), authlib.FixedAccessClient(false), map[string]float64{
		"datasource.grafana.app/datasources/query": 1,
	})
	req := authlib.BatchCheckRequest{Namespace: "stacks-1", Checks: []authlib.BatchCheckItem{
		{CorrelationID: "1", Group: "loki.datasource.grafana.app", Resource: "datasources", Subresource: "query", Verb: "create", Name: "ds1"},
		{CorrelationID: "2", Group: "query.grafana.app", Resource: "query", Verb: "create", Name: "ds1"},
	}}
	res, err := client.BatchCheck(context.Background(), &identity.StaticRequester{Namespace: "stacks-1"}, req)
	require.NoError(t, err)
	assert.False(t, res.Results["1"].Allowed)
	assert.False(t, res.Results["2"].Allowed)
	assert.Equal(t, "loki.datasource.grafana.app", req.Checks[0].Group)
	assert.Equal(t, "query.grafana.app", req.Checks[1].Group)
}
