package metrics

import (
	"testing"

	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/require"
)

func TestGathererPrefixWrapper_Gather(t *testing.T) {
	orig := &mockGatherer{}
	g := newAddPrefixWrapper(orig)

	t.Run("metrics with grafana and go prefix are not modified", func(t *testing.T) {
		originalMF := []*dto.MetricFamily{
			{Name: new("grafana_metric1")},
			{Name: new("metric2")},
			{Name: new("go_metric1")},
		}

		orig.GatherFunc = func() ([]*dto.MetricFamily, error) {
			return originalMF, nil
		}

		expectedMF := []*dto.MetricFamily{
			{Name: new("grafana_metric1")},
			{Name: new("grafana_metric2")},
			{Name: new("go_metric1")},
		}

		mf, err := g.Gather()
		require.NoError(t, err)
		require.Equal(t, expectedMF, mf)
	})

	t.Run("duplicate metrics result in an error", func(t *testing.T) {
		originalMF := []*dto.MetricFamily{
			{Name: new("grafana_metric1")},
			{Name: new("metric1")},
		}

		orig.GatherFunc = func() ([]*dto.MetricFamily, error) {
			return originalMF, nil
		}

		_, err := g.Gather()
		require.Error(t, err)
	})
}

func TestMultiRegistry_Gather(t *testing.T) {
	one := &mockGatherer{}
	two := &mockGatherer{}
	g := NewMultiRegistry(one, two)

	t.Run("should merge and sort metrics", func(t *testing.T) {
		one.GatherFunc = func() ([]*dto.MetricFamily, error) {
			return []*dto.MetricFamily{
				{Name: new("b")},
				{Name: new("a")},
			}, nil
		}

		two.GatherFunc = func() ([]*dto.MetricFamily, error) {
			return []*dto.MetricFamily{
				{Name: new("d")},
				{Name: new("c")},
			}, nil
		}

		expectedMF := []*dto.MetricFamily{
			{Name: new("a")},
			{Name: new("b")},
			{Name: new("c")},
			{Name: new("d")},
		}

		mf, err := g.Gather()
		require.NoError(t, err)
		require.Equal(t, expectedMF, mf)
	})

	t.Run("duplicate metrics result in an error", func(t *testing.T) {
		one.GatherFunc = func() ([]*dto.MetricFamily, error) {
			return []*dto.MetricFamily{
				{Name: new("b")},
				{Name: new("a")},
			}, nil
		}

		two.GatherFunc = func() ([]*dto.MetricFamily, error) {
			return []*dto.MetricFamily{
				{Name: new("d")},
				{Name: new("c")},
				{Name: new("a")},
			}, nil
		}
		_, err := g.Gather()
		require.Error(t, err)
	})

	t.Run("duplicate go_ or process_ prefixed metrics do not result in an error", func(t *testing.T) {
		one.GatherFunc = func() ([]*dto.MetricFamily, error) {
			return []*dto.MetricFamily{
				{Name: new("b")},
				{Name: new("a")},
				{Name: new("go_a")},
				{Name: new("process_a")},
			}, nil
		}

		two.GatherFunc = func() ([]*dto.MetricFamily, error) {
			return []*dto.MetricFamily{
				{Name: new("d")},
				{Name: new("c")},
				{Name: new("go_a")},
				{Name: new("process_a")},
			}, nil
		}

		expectedMF := []*dto.MetricFamily{
			{Name: new("a")},
			{Name: new("b")},
			{Name: new("c")},
			{Name: new("d")},
			{Name: new("go_a")},
			{Name: new("process_a")},
		}

		mf, err := g.Gather()
		require.NoError(t, err)
		require.Equal(t, expectedMF, mf)
	})

	t.Run("denied metrics are not included", func(t *testing.T) {
		one.GatherFunc = func() ([]*dto.MetricFamily, error) {
			return []*dto.MetricFamily{
				{Name: new("grafana_apiserver_request_slo_duration_seconds_bucket")},
			}, nil
		}

		two.GatherFunc = func() ([]*dto.MetricFamily, error) {
			return []*dto.MetricFamily{
				{Name: new("b")},
				{Name: new("a")},
			}, nil
		}

		expectedMF := []*dto.MetricFamily{
			{Name: new("a")},
			{Name: new("b")},
		}

		mf, err := g.Gather()
		require.NoError(t, err)
		require.Equal(t, expectedMF, mf)
	})
}

type mockGatherer struct {
	GatherFunc func() ([]*dto.MetricFamily, error)
}

func (m *mockGatherer) Gather() ([]*dto.MetricFamily, error) {
	return m.GatherFunc()
}
