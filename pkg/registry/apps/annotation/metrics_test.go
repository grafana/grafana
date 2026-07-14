package annotation

import (
	"errors"
	"fmt"
	"testing"

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
