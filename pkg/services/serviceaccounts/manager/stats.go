package manager

import (
	"context"

	"github.com/prometheus/client_golang/prometheus"
)

const (
	ExporterName = "grafana"
)

var (
	// MStatTotalServiceAccounts is a metric gauge for total number of service accounts
	MStatTotalServiceAccounts prometheus.Gauge

	// MStatTotalServiceAccountTokens is a metric gauge for total number of service account tokens
	MStatTotalServiceAccountTokens prometheus.Gauge

	Initialised bool = false
)

func init() {
	MStatTotalServiceAccounts = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_total_service_accounts",
		Help:      "total amount of service accounts",
		Namespace: ExporterName,
	})

	MStatTotalServiceAccountTokens = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_total_service_account_tokens",
		Help:      "total amount of service account tokens",
		Namespace: ExporterName,
	})

	prometheus.MustRegister(
		MStatTotalServiceAccounts,
		MStatTotalServiceAccountTokens,
	)
}

func (sa *ServiceAccountsService) getUsageMetrics(ctx context.Context) (map[string]interface{}, error) {
	stats := map[string]interface{}{}

	sqlStats, err := sa.store.GetUsageMetrics(ctx)
	if err != nil {
		return nil, err
	}

	stats["stats.serviceaccounts.count"] = sqlStats.ServiceAccounts
	stats["stats.serviceaccounts.tokens.count"] = sqlStats.Tokens

	MStatTotalServiceAccountTokens.Set(float64(sqlStats.Tokens))
	MStatTotalServiceAccounts.Set(float64(sqlStats.ServiceAccounts))

	return stats, nil
}
