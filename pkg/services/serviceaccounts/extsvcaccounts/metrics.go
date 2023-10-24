package extsvcaccounts

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/extsvcauth"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/prometheus/client_golang/prometheus"
)

type metrics struct {
	extSvcAccCount        prometheus.GaugeFunc
	extSvcAccSavedCount   prometheus.Counter
	extSvcAccDeletedCount prometheus.Counter
}

func newMetrics(reg prometheus.Registerer, saSvc serviceaccounts.Service, logger log.Logger) *metrics {
	var m metrics

	m.extSvcAccCount = prometheus.NewGaugeFunc(
		prometheus.GaugeOpts{
			Namespace: metricsNamespace,
			Name:      "extsvc_total",
			Help:      "Number of external service accounts in store",
		},
		func() float64 {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			res, err := saSvc.SearchOrgServiceAccounts(ctx, &serviceaccounts.SearchOrgServiceAccountsQuery{
				OrgID:     extsvcauth.TmpOrgID,
				Filter:    serviceaccounts.FilterOnlyExternal,
				CountOnly: true,
				SignedInUser: &user.SignedInUser{
					OrgID: extsvcauth.TmpOrgID,
					Permissions: map[int64]map[string][]string{
						extsvcauth.TmpOrgID: {serviceaccounts.ActionRead: {"serviceaccounts:id:*"}},
					},
				},
			})
			if err != nil {
				logger.Error("Could not compute extsvc_total metric", "error", err)
				return 0.0
			}
			return float64(res.TotalCount)
		},
	)
	m.extSvcAccSavedCount = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Name:      "extsvc_saved_total",
		Help:      "Number of external service accounts saved since start up.",
	})
	m.extSvcAccDeletedCount = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Name:      "extsvc_deleted_total",
		Help:      "Number of external service accounts deleted since start up.",
	})

	if reg != nil {
		reg.MustRegister(m.extSvcAccCount)
		reg.MustRegister(m.extSvcAccSavedCount)
		reg.MustRegister(m.extSvcAccDeletedCount)
	}

	return &m
}
