package state

import (
	"context"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type seriesRecordingStore struct {
	*FakeInstanceStore
	plainSyncs  int
	seriesSyncs int
	lastSeries  map[models.AlertRuleKey][]models.RecordingSeries
}

func (s *seriesRecordingStore) FullSync(ctx context.Context, instances []models.AlertInstance, batchSize int, jitter func(int) time.Duration) error {
	s.plainSyncs++
	return nil
}

func (s *seriesRecordingStore) FullSyncWithSeries(_ context.Context, _ []models.AlertInstance, series map[models.AlertRuleKey][]models.RecordingSeries, _ int, _ func(int) time.Duration) error {
	s.seriesSyncs++
	s.lastSeries = series
	return nil
}

func (s *seriesRecordingStore) SaveRecordingSeriesForRule(context.Context, models.AlertRuleKeyWithGroup, []models.RecordingSeries) error {
	return nil
}

func (s *seriesRecordingStore) ListRecordingSeries(context.Context, int64) (map[string][]models.RecordingSeries, error) {
	return nil, nil
}

func (s *seriesRecordingStore) DeleteRecordingSeriesForRule(context.Context, models.AlertRuleKeyWithGroup) error {
	return nil
}

type seriesProvider struct {
	*cache
	series map[models.AlertRuleKey][]models.RecordingSeries
}

func (p seriesProvider) GetRecordingSeries() map[models.AlertRuleKey][]models.RecordingSeries {
	return p.series
}

func TestAsyncRuleStatePersister_FullSyncSeries(t *testing.T) {
	key := models.AlertRuleKey{OrgID: 1, UID: "rule"}
	series := map[models.AlertRuleKey][]models.RecordingSeries{key: {{Metric: "m", Labels: map[string]string{"a": "b"}}}}

	t.Run("sends the series when the store and the provider support them", func(t *testing.T) {
		store := &seriesRecordingStore{FakeInstanceStore: &FakeInstanceStore{}}
		p := NewAsyncRuleStatePersister(log.New("test"), clock.New(), time.Second, ManagerCfg{InstanceStore: store}).(*AsyncRuleStatePersister)

		require.NoError(t, p.fullSync(context.Background(), seriesProvider{cache: newCache(), series: series}))

		require.Equal(t, 1, store.seriesSyncs)
		require.Equal(t, 0, store.plainSyncs)
		require.Equal(t, series, store.lastSeries)
	})

	t.Run("falls back to the plain sync when the provider has no series", func(t *testing.T) {
		store := &seriesRecordingStore{FakeInstanceStore: &FakeInstanceStore{}}
		p := NewAsyncRuleStatePersister(log.New("test"), clock.New(), time.Second, ManagerCfg{InstanceStore: store}).(*AsyncRuleStatePersister)

		require.NoError(t, p.fullSync(context.Background(), newCache()))

		require.Equal(t, 0, store.seriesSyncs)
		require.Equal(t, 1, store.plainSyncs)
	})

	t.Run("a store without series support keeps working", func(t *testing.T) {
		store := &FakeInstanceStore{}
		_, implements := any(store).(RecordingSeriesStore)
		require.False(t, implements, "existing stores must not be required to implement the optional interface")

		p := NewAsyncRuleStatePersister(log.New("test"), clock.New(), time.Second, ManagerCfg{InstanceStore: store}).(*AsyncRuleStatePersister)

		c := newCache()
		c.set(&State{OrgID: 1, AlertRuleUID: "alert", State: eval.Normal})
		require.NoError(t, p.fullSync(context.Background(), seriesProvider{cache: c, series: series}))
		require.Len(t, store.RecordedOps(), 1)
	})
}
