package diagnostics

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/usagestats"
)

const metricsNamespace = "datasource-diagnostics"

type Scope string

const (
	ScopePanel     Scope = "panel"
	ScopeDashboard Scope = "dashboard"
)

type Result string

const (
	ResultSuccess Result = "success"
	ResultError   Result = "error"
)

type Metrics struct {
	log   log.Logger
	store counterStore
	runs  *prometheus.CounterVec
}

func NewMetrics(sqlStore db.DB, usageStats usagestats.Service, reg prometheus.Registerer) *Metrics {
	return newMetrics(&dbCounterStore{db: sqlStore}, usageStats, reg)
}

func newMetrics(store counterStore, usageStats usagestats.Service, reg prometheus.Registerer) *Metrics {
	runs := prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: "grafana",
		Name:      "ds_diagnostics_runs_total",
		Help:      "Total number of completed on-demand datasource diagnostics runs.",
	}, []string{"scope", "result"})
	reg.MustRegister(runs)

	for _, scope := range []Scope{ScopePanel, ScopeDashboard} {
		for _, result := range []Result{ResultSuccess, ResultError} {
			runs.WithLabelValues(string(scope), string(result))
		}
	}

	m := &Metrics{
		log:   log.New("diagnostics.metrics"),
		store: store,
		runs:  runs,
	}
	usageStats.RegisterMetricsFunc(m.getUsageStats)
	return m
}

func (m *Metrics) RecordStarted(ctx context.Context, scope Scope) {
	if err := m.increment(ctx, runsKey(scope)); err != nil {
		m.log.Warn("Failed to persist diagnostics run metric", "scope", scope, "err", err)
	}
}

func (m *Metrics) RecordCompleted(ctx context.Context, scope Scope, result Result) {
	m.runs.WithLabelValues(string(scope), string(result)).Inc()
	if result != ResultError {
		return
	}
	if err := m.increment(ctx, errorsKey(scope)); err != nil {
		m.log.Warn("Failed to persist diagnostics error metric", "scope", scope, "err", err)
	}
}

func (m *Metrics) getUsageStats(ctx context.Context) (map[string]any, error) {
	panelRuns, err := m.store.Read(ctx, runsKey(ScopePanel))
	if err != nil {
		return nil, err
	}
	panelErrors, err := m.store.Read(ctx, errorsKey(ScopePanel))
	if err != nil {
		return nil, err
	}
	dashboardRuns, err := m.store.Read(ctx, runsKey(ScopeDashboard))
	if err != nil {
		return nil, err
	}
	dashboardErrors, err := m.store.Read(ctx, errorsKey(ScopeDashboard))
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"stats.ds_diagnostics.panel_runs.count":       panelRuns,
		"stats.ds_diagnostics.panel_errors.count":     panelErrors,
		"stats.ds_diagnostics.dashboard_runs.count":   dashboardRuns,
		"stats.ds_diagnostics.dashboard_errors.count": dashboardErrors,
	}, nil
}

func (m *Metrics) increment(ctx context.Context, key string) error {
	// Usage counters describe an accepted or completed run and must survive the initiating HTTP
	// request being canceled. Preserve context values while detaching cancellation and deadlines.
	return m.store.Increment(context.WithoutCancel(ctx), key)
}

type counterStore interface {
	Increment(context.Context, string) error
	Read(context.Context, string) (int64, error)
}

type dbCounterStore struct {
	db db.DB
}

func (s *dbCounterStore) Increment(ctx context.Context, key string) error {
	const maxInsertAttempts = 3
	var err error
	for range maxInsertAttempts {
		err = s.db.WithTransactionalDbSession(ctx, func(session *db.Session) error {
			item, exists, getErr := s.getForUpdate(session, key)
			if getErr != nil {
				return getErr
			}

			now := time.Now()
			if !exists {
				orgID := int64(0)
				namespace := metricsNamespace
				item = &kvstore.Item{
					OrgId:     &orgID,
					Namespace: &namespace,
					Key:       &key,
					Value:     "1",
					Created:   now,
					Updated:   now,
				}
				_, insertErr := session.Insert(item)
				return insertErr
			}

			value, parseErr := parseCounter(key, item.Value)
			if parseErr != nil {
				return parseErr
			}
			item.Value = strconv.FormatInt(value+1, 10)
			item.Updated = now
			_, updateErr := session.ID(item.Id).Cols("value", "updated").Update(item)
			return updateErr
		})
		if err == nil {
			return nil
		}
		if !s.db.GetDialect().IsUniqueConstraintViolation(err) {
			return err
		}
	}
	return fmt.Errorf("initialize diagnostics metric %q after concurrent insert: %w", key, err)
}

func (s *dbCounterStore) Read(ctx context.Context, key string) (int64, error) {
	var value int64
	err := s.db.WithDbSession(ctx, func(session *db.Session) error {
		item, exists, getErr := s.get(session, key)
		if getErr != nil || !exists {
			return getErr
		}
		value, getErr = parseCounter(key, item.Value)
		return getErr
	})
	return value, err
}

func (s *dbCounterStore) getForUpdate(session *db.Session, key string) (*kvstore.Item, bool, error) {
	item := &kvstore.Item{}
	exists, err := session.Where("org_id = ? AND namespace = ? AND "+s.db.Quote("key")+" = ?", 0, metricsNamespace, key).
		ForUpdate().Get(item)
	return item, exists, err
}

func (s *dbCounterStore) get(session *db.Session, key string) (*kvstore.Item, bool, error) {
	item := &kvstore.Item{}
	exists, err := session.Where("org_id = ? AND namespace = ? AND "+s.db.Quote("key")+" = ?", 0, metricsNamespace, key).Get(item)
	return item, exists, err
}

func parseCounter(key, value string) (int64, error) {
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("parse diagnostics metric %q: %w", key, err)
	}
	return parsed, nil
}

func runsKey(scope Scope) string {
	return string(scope) + "-runs"
}

func errorsKey(scope Scope) string {
	return string(scope) + "-errors"
}
