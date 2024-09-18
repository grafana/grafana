package extsvcaccounts

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/prometheus/client_golang/prometheus"
)

type metrics struct {
	storedCount  prometheus.GaugeFunc
	savedCount   prometheus.Counter
	deletedCount prometheus.Counter
}

func newMetrics(reg prometheus.Registerer, defaultOrgID int64, saSvc serviceaccounts.Service, logger log.Logger) *metrics {
	var m metrics

	m.storedCount = prometheus.NewGaugeFunc(
		prometheus.GaugeOpts{
			Namespace: metricsNamespace,
			Name:      "extsvc_total",
			Help:      "Number of external service accounts in store",
		},
		func() float64 {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			res, err := saSvc.SearchOrgServiceAccounts(ctx, &serviceaccounts.SearchOrgServiceAccountsQuery{
				OrgID:        defaultOrgID,
				Filter:       serviceaccounts.FilterOnlyExternal,
				CountOnly:    true,
				SignedInUser: extsvcuser(defaultOrgID),
			})
			if err != nil {
				logger.Error("Could not compute extsvc_total metric", "error", err)
				return 0.0
			}
			return float64(res.TotalCount)
		},
	)
	m.savedCount = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Name:      "extsvc_saved_total",
		Help:      "Number of external service accounts saved since start up.",
	})
	m.deletedCount = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Name:      "extsvc_deleted_total",
		Help:      "Number of external service accounts deleted since start up.",
	})

	if reg != nil {
		reg.MustRegister(m.storedCount)
		reg.MustRegister(m.savedCount)
		reg.MustRegister(m.deletedCount)
	}

	return &m
}
