package acimpl

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestFallbackComparisonCategories(t *testing.T) {
	tests := []struct {
		name           string
		rbacAllowed    bool
		zanzanaAllowed bool
		err            error
		shadowEngine   string
		context        func() context.Context
		result         string
	}{
		{name: "match", rbacAllowed: true, zanzanaAllowed: true, result: "match"},
		{name: "Zanzana allows", zanzanaAllowed: true, result: "zanzana_allow_rbac_deny"},
		{name: "RBAC allows", rbacAllowed: true, result: "zanzana_deny_rbac_allow"},
		{name: "Zanzana error", err: errors.New("unavailable"), shadowEngine: "zanzana", result: "zanzana_error"},
		{name: "RBAC error", err: errors.New("failed"), shadowEngine: "rbac", result: "rbac_error"},
		{
			name: "shadow timeout", err: context.DeadlineExceeded, result: "shadow_timeout",
			context: func() context.Context {
				ctx, cancel := context.WithDeadline(context.Background(), time.Now().Add(-time.Second))
				defer cancel()
				return ctx
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a := ProvideAccessControl(featuremgmt.WithFeatures())
			ctx := context.Background()
			if tt.context != nil {
				ctx = tt.context()
			}

			a.recordComparison(ctx, accesscontrol.EvalPermission("plugins.app:read", "plugins:id:one"), tt.rbacAllowed, tt.zanzanaAllowed, tt.err, tt.shadowEngine)

			require.Equal(t, float64(1), testutil.ToFloat64(a.metrics.comparisons.WithLabelValues(tt.result)))
		})
	}
}
