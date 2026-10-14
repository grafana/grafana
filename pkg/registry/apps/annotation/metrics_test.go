package annotation

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestStatusLabel(t *testing.T) {
	gr := schema.GroupResource{Group: "annotation.grafana.app", Resource: "annotations"}
	cases := []struct {
		name string
		err  error
		want string
	}{
		{"nil", nil, "ok"},
		{"grafana ErrNotFound", ErrNotFound, "not_found"},
		{"wrapped grafana ErrNotFound", fmt.Errorf("lookup: %w", ErrNotFound), "not_found"},
		{"apierrors NotFound", apierrors.NewNotFound(gr, "x"), "not_found"},
		{"grafana ErrAlreadyExists", ErrAlreadyExists, "conflict"},
		{"wrapped grafana ErrAlreadyExists", fmt.Errorf("backend: %w", ErrAlreadyExists), "conflict"},
		{"apierrors AlreadyExists", apierrors.NewAlreadyExists(gr, "x"), "conflict"},
		{"apierrors Forbidden", apierrors.NewForbidden(gr, "x", errors.New("nope")), "forbidden"},
		{"grafana ErrInvalidInput", ErrInvalidInput, "bad_request"},
		{"wrapped grafana ErrInvalidInput", fmt.Errorf("parse: %w", ErrInvalidInput), "bad_request"},
		{"apierrors BadRequest", apierrors.NewBadRequest("malformed"), "bad_request"},
		{"apierrors Invalid", apierrors.NewInvalid(schema.GroupKind{Group: gr.Group, Kind: "Annotation"}, "x", nil), "bad_request"},
		{"generic", errors.New("boom"), "error"},
		{"wrapped generic", fmt.Errorf("layer: %w", errors.New("boom")), "error"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, statusLabel(tc.err))
		})
	}
}

// TestProvideMetrics_NilRegisterer ensures construction succeeds when no
// registerer is wired (tests that don't care about exposition still need a
// usable *Metrics) and that every collector field is observable.
func TestProvideMetrics_NilRegisterer(t *testing.T) {
	m := ProvideMetrics(nil)
	require.NotNil(t, m)
	require.NotPanics(t, func() {
		// Make sure the collectors are real and observable, not zero values.
		m.RequestDuration.WithLabelValues("get", "ok").Observe(0.01)
		m.StoreOperationDuration.WithLabelValues("get", "ok").Observe(0.01)
		m.CleanupDuration.Observe(0.01)
		m.CleanupRuns.WithLabelValues("success").Inc()
		m.CleanupRuns.WithLabelValues("failure").Inc()
		m.CleanupRowsDeleted.Add(1)
		m.TagCacheHits.Inc()
		m.TagCacheMisses.Inc()
	})
}

func TestPgxPoolCollector(t *testing.T) {
	cfg, err := pgxpool.ParseConfig("postgres://localhost:1/annotations")
	require.NoError(t, err)
	cfg.MaxConns = 7
	pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	c := newPgxPoolCollector(pool)
	problems, err := testutil.CollectAndLint(c)
	require.NoError(t, err)
	assert.Empty(t, problems)

	require.NoError(t, testutil.CollectAndCompare(c, strings.NewReader(`
		# HELP grafana_annotations_pgxpool_acquire_duration_seconds_total Cumulative time spent in successful acquires from the pool.
		# TYPE grafana_annotations_pgxpool_acquire_duration_seconds_total counter
		grafana_annotations_pgxpool_acquire_duration_seconds_total 0
		# HELP grafana_annotations_pgxpool_acquire_total Cumulative count of successful acquires from the pool.
		# TYPE grafana_annotations_pgxpool_acquire_total counter
		grafana_annotations_pgxpool_acquire_total 0
		# HELP grafana_annotations_pgxpool_acquired_conns Number of currently acquired connections in the pool.
		# TYPE grafana_annotations_pgxpool_acquired_conns gauge
		grafana_annotations_pgxpool_acquired_conns 0
		# HELP grafana_annotations_pgxpool_canceled_acquire_total Cumulative count of acquires canceled by their context.
		# TYPE grafana_annotations_pgxpool_canceled_acquire_total counter
		grafana_annotations_pgxpool_canceled_acquire_total 0
		# HELP grafana_annotations_pgxpool_constructing_conns Number of connections currently being established.
		# TYPE grafana_annotations_pgxpool_constructing_conns gauge
		grafana_annotations_pgxpool_constructing_conns 0
		# HELP grafana_annotations_pgxpool_empty_acquire_total Cumulative count of acquires that had to wait for a connection.
		# TYPE grafana_annotations_pgxpool_empty_acquire_total counter
		grafana_annotations_pgxpool_empty_acquire_total 0
		# HELP grafana_annotations_pgxpool_empty_acquire_wait_seconds_total Cumulative time successful acquires spent waiting for a connection to be released or established because the pool was empty.
		# TYPE grafana_annotations_pgxpool_empty_acquire_wait_seconds_total counter
		grafana_annotations_pgxpool_empty_acquire_wait_seconds_total 0
		# HELP grafana_annotations_pgxpool_idle_conns Number of currently idle connections in the pool.
		# TYPE grafana_annotations_pgxpool_idle_conns gauge
		grafana_annotations_pgxpool_idle_conns 0
		# HELP grafana_annotations_pgxpool_max_conns Maximum size of the pool.
		# TYPE grafana_annotations_pgxpool_max_conns gauge
		grafana_annotations_pgxpool_max_conns 7
		# HELP grafana_annotations_pgxpool_total_conns Total number of resources currently in the pool.
		# TYPE grafana_annotations_pgxpool_total_conns gauge
		grafana_annotations_pgxpool_total_conns 0
	`)))
}
