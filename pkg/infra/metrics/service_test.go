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
			{Name: strptr("grafana_metric1")},
			{Name: strptr("metric2")},
			{Name: strptr("go_metric1")},
		}

		orig.GatherFunc = func() ([]*dto.MetricFamily, error) {
			return originalMF, nil
		}

		expectedMF := []*dto.MetricFamily{
			{Name: strptr("grafana_metric1")},
			{Name: strptr("grafana_metric2")},
			{Name: strptr("go_metric1")},
		}

		mf, err := g.Gather()
		require.NoError(t, err)
		require.Equal(t, expectedMF, mf)
	})

	t.Run("duplicate metrics result in an error", func(t *testing.T) {
		originalMF := []*dto.MetricFamily{
			{Name: strptr("grafana_metric1")},
			{Name: strptr("metric1")},
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
				{Name: strptr("b")},
				{Name: strptr("a")},
			}, nil
		}

		two.GatherFunc = func() ([]*dto.MetricFamily, error) {
			return []*dto.MetricFamily{
				{Name: strptr("d")},
				{Name: strptr("c")},
			}, nil
		}

		expectedMF := []*dto.MetricFamily{
			{Name: strptr("a")},
			{Name: strptr("b")},
			{Name: strptr("c")},
			{Name: strptr("d")},
		}

		mf, err := g.Gather()
		require.NoError(t, err)
		require.Equal(t, expectedMF, mf)
	})

	t.Run("duplicate metrics result in an error", func(t *testing.T) {
		one.GatherFunc = func() ([]*dto.MetricFamily, error) {
			return []*dto.MetricFamily{
				{Name: strptr("b")},
				{Name: strptr("a")},
			}, nil
		}

		two.GatherFunc = func() ([]*dto.MetricFamily, error) {
			return []*dto.MetricFamily{
				{Name: strptr("d")},
				{Name: strptr("c")},
				{Name: strptr("a")},
			}, nil
		}
		_, err := g.Gather()
		require.Error(t, err)
	})

	t.Run("duplicate go_ or process_ prefixed metrics do not result in an error", func(t *testing.T) {
		one.GatherFunc = func() ([]*dto.MetricFamily, error) {
			return []*dto.MetricFamily{
				{Name: strptr("b")},
				{Name: strptr("a")},
				{Name: strptr("go_a")},
				{Name: strptr("process_a")},
			}, nil
		}

		two.GatherFunc = func() ([]*dto.MetricFamily, error) {
			return []*dto.MetricFamily{
				{Name: strptr("d")},
				{Name: strptr("c")},
				{Name: strptr("go_a")},
				{Name: strptr("process_a")},
			}, nil
		}

		expectedMF := []*dto.MetricFamily{
			{Name: strptr("a")},
			{Name: strptr("b")},
			{Name: strptr("c")},
			{Name: strptr("d")},
			{Name: strptr("go_a")},
			{Name: strptr("process_a")},
		}

		mf, err := g.Gather()
		require.NoError(t, err)
		require.Equal(t, expectedMF, mf)
	})

	t.Run("denied metrics are not included", func(t *testing.T) {
		one.GatherFunc = func() ([]*dto.MetricFamily, error) {
			return []*dto.MetricFamily{
				{Name: strptr("grafana_apiserver_request_slo_duration_seconds_bucket")},
			}, nil
		}

		two.GatherFunc = func() ([]*dto.MetricFamily, error) {
			return []*dto.MetricFamily{
				{Name: strptr("b")},
				{Name: strptr("a")},
			}, nil
		}

		expectedMF := []*dto.MetricFamily{
			{Name: strptr("a")},
			{Name: strptr("b")},
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

func strptr(s string) *string {
	return &s
}
