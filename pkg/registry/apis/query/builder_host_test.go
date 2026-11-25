package query_test

import (
	"context"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/query"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// A host outside this repository builds the query API with exactly these positional arguments and
// supplies its own connections provider, so the constructor must keep accepting them.
func TestNewQueryAPIBuilderHostSignature(t *testing.T) {
	b, err := query.NewQueryAPIBuilder(
		featuremgmt.WithFeatures(),
		nil, // instance provider
		nil, // authorizer
		nil, // datasource API server registry
		prometheus.NewRegistry(),
		tracing.InitializeTracerForTest(),
		nil, // legacy datasource lookup
		nil, // connections provider
		4,
		func(context.Context, int) {},
	)
	require.NoError(t, err)
	require.NotNil(t, b)
}
