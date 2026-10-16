package informer

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The rollout is read off this counter, so the labels it reports are part of the
// contract: a dashboard filtering projection="keys" has to see the keys path and
// only the keys path.
func TestRelistProjectionMetrics_ReportsTheProjection(t *testing.T) {
	reg := prometheus.NewRegistry()
	// The job delta source already owns the delivery metrics on this registry; the
	// projection collectors are separate, so they do not collide.
	_ = newInformerMetrics(reg)
	recorder := NewRelistProjectionMetrics(reg).Recorder(connGVR)

	recorder.Projection(true)
	recorder.Projection(true)
	recorder.Projection(false)

	assert.Equal(t, float64(2), projectionCount(t, reg, connGVR, "keys"))
	assert.Equal(t, float64(1), projectionCount(t, reg, connGVR, "objects"))
}

// The group is part of the series identity: the keys projection is a
// unified-storage feature that any group can report here, so a query that reads
// only the resource name would silently sum two of them together.
//
// Binding the recorder also creates both projections at zero, so the fallback
// series exists before anything falls back.
func TestRelistProjectionMetrics_LabelsTheGroup(t *testing.T) {
	reg := prometheus.NewRegistry()
	NewRelistProjectionMetrics(reg).Recorder(connGVR).Projection(true)

	assert.ElementsMatch(t, []map[string]string{
		{"group": connGVR.Group, "resource": connGVR.Resource, "projection": "keys"},
		{"group": connGVR.Group, "resource": connGVR.Resource, "projection": "objects"},
	}, projectionLabelSets(t, reg))

	assert.Equal(t, float64(1), projectionCount(t, reg, connGVR, "keys"))
	assert.Zero(t, projectionCount(t, reg, connGVR, "objects"), "present, and zero until it fires")
}

// The collectors are shared by every delta source, so one registry has to serve
// them all; registering per source would panic on the second.
func TestRelistProjectionMetrics_SharedAcrossResources(t *testing.T) {
	reg := prometheus.NewRegistry()
	metrics := NewRelistProjectionMetrics(reg)

	metrics.Recorder(connGVR).Projection(true)
	metrics.Recorder(repoGVR).Projection(false)

	assert.Equal(t, float64(1), projectionCount(t, reg, connGVR, "keys"))
	assert.Equal(t, float64(1), projectionCount(t, reg, repoGVR, "objects"))
	assert.Zero(t, projectionCount(t, reg, connGVR, "objects"), "the resources must not share a series")
}

// A delta source built without metrics records nothing rather than panicking.
func TestRelistRecorder_ZeroValueDiscards(t *testing.T) {
	var recorder RelistRecorder
	recorder.Projection(true)
}

// projectionLabelSets returns the label sets of every projection series in reg.
func projectionLabelSets(t *testing.T, reg *prometheus.Registry) []map[string]string {
	t.Helper()
	families, err := reg.Gather()
	require.NoError(t, err)

	var out []map[string]string
	for _, mf := range families {
		if mf.GetName() != "grafana_provisioning_informer_relist_projection_total" {
			continue
		}
		for _, m := range mf.GetMetric() {
			labels := map[string]string{}
			for _, l := range m.GetLabel() {
				labels[l.GetName()] = l.GetValue()
			}
			out = append(out, labels)
		}
	}
	return out
}
