package schedule

import (
	context "context"
	"errors"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	models "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
)

func TestFetcher(t *testing.T) {
	t.Parallel() // Some tests here do a time.Wait()

	t.Run("empty on construction", func(t *testing.T) {
		ruleStore := newFakeRulesStore()
		fetcher := createTestFetcher(1*time.Second, ruleStore)

		r, f := fetcher.Rules()

		require.Empty(t, r)
		require.Empty(t, f)
	})

	t.Run("stores rules from latest fetch", func(t *testing.T) {
		ruleStore := newFakeRulesStore()
		ruleStore.PutRule(context.Background(), models.AlertRuleGen()())
		fetcher := createTestFetcher(1*time.Second, ruleStore)

		fetcher.updateSchedulableAlertRules(context.Background())
		r, f := fetcher.Rules()

		require.Len(t, r, 1)
		require.Len(t, f, 1)
	})

	t.Run("Refresh updates fetcher with new objects", func(t *testing.T) {
		ruleStore := newFakeRulesStore()
		ruleGen := models.AlertRuleGen(models.WithUniqueID())
		ruleStore.PutRule(context.Background(), ruleGen())
		fetcher := createTestFetcher(1*time.Second, ruleStore)
		fetcher.updateSchedulableAlertRules(context.Background())

		ruleStore.PutRule(context.Background(), models.AlertRuleGen()())
		r, _ := fetcher.Rules()
		require.Len(t, r, 1)
		fetcher.Refresh(context.Background())
		r, _ = fetcher.Rules()

		require.Len(t, r, 2)
	})

	t.Run("keeps last state if fetch fails", func(t *testing.T) {
		ruleStore := newFakeRulesStore()
		ruleGen := models.AlertRuleGen(models.WithUniqueID())
		ruleStore.PutRule(context.Background(), ruleGen())
		fetcher := createTestFetcher(1*time.Second, ruleStore)
		fetcher.Refresh(context.Background())
		fetcher.ruleStore = &fakeFailingRuleStore{}
		r, _ := fetcher.Rules()
		require.Len(t, r, 1)

		fetcher.Refresh(context.Background())
		r, _ = fetcher.Rules()

		require.Len(t, r, 1)
	})

	t.Run("fetches asynchronously in background if run", func(t *testing.T) {
		ruleStore := newFakeRulesStore()
		ruleGen := models.AlertRuleGen(models.WithUniqueID())
		ruleStore.PutRule(context.Background(), ruleGen())
		fetcher := createTestFetcher(1*time.Millisecond, ruleStore)
		r, _ := fetcher.Rules()
		require.Len(t, r, 0)

		ctx, stop := context.WithCancel(context.Background())
		go func() {
			err := fetcher.Run(ctx)
			require.NoError(t, err)
		}()
		time.Sleep(10 * time.Millisecond)
		stop()

		r, _ = fetcher.Rules()
		require.Len(t, r, 1)
	})
}

func createTestFetcher(reloadInterval time.Duration, ruleStore RulesStore) *BackgroundFetcher {
	metrics := metrics.NewSchedulerMetrics(prometheus.NewRegistry())
	logger := log.NewNopLogger()
	cfg := FetcherCfg{
		ReloadInterval: reloadInterval,
	}
	return NewBackgroundFetcher(cfg, ruleStore, metrics, logger)
}

type fakeFailingRuleStore struct{}

func (f *fakeFailingRuleStore) GetAlertRulesKeysForScheduling(ctx context.Context) ([]models.AlertRuleKeyWithVersion, error) {
	return nil, errors.New("GetAlertRulesKeysForScheduling failed")
}

func (f *fakeFailingRuleStore) GetAlertRulesForScheduling(ctx context.Context, query *models.GetAlertRulesForSchedulingQuery) error {
	return errors.New("GetAlertRulesKeysForScheduling failed")
}
