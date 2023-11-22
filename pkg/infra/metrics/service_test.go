package metrics

import (
	"testing"

	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/require"
)

func TestK8sGathererWrapper_Gather(t *testing.T) {
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

type mockGatherer struct {
	GatherFunc func() ([]*dto.MetricFamily, error)
}

func (m *mockGatherer) Gather() ([]*dto.MetricFamily, error) {
	return m.GatherFunc()
}

func strptr(s string) *string {
	return &s
}
