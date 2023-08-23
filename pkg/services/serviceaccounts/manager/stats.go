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

	// MStatTotalServiceAccountsNoRole is a metric gauge for total number of user accounts with no role
	MStatTotalServiceAccountsNoRole prometheus.Gauge

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

	MStatTotalServiceAccountsNoRole = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_total_service_accounts_role_none",
		Help:      "total amount of service accounts with no role",
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
		MStatTotalServiceAccountsNoRole,
	)
}

func (sa *ServiceAccountsService) getUsageMetrics(ctx context.Context) (map[string]interface{}, error) {
	stats := map[string]interface{}{}

	storeStats, err := sa.store.GetUsageMetrics(ctx)
	if err != nil {
		return nil, err
	}

	stats["stats.serviceaccounts.count"] = storeStats.ServiceAccounts
	stats["stats.serviceaccounts.role_none.count"] = storeStats.ServiceAccountsWithNoRole
	stats["stats.serviceaccounts.tokens.count"] = storeStats.Tokens

	var forcedExpiryEnabled int64 = 0
	if storeStats.ForcedExpiryEnabled {
		forcedExpiryEnabled = 1
	}

	stats["stats.serviceaccounts.forced_expiry_enabled.count"] = forcedExpiryEnabled

	var secretScanEnabled int64 = 0
	if sa.secretScanEnabled {
		secretScanEnabled = 1
	}

	stats["stats.serviceaccounts.secret_scan.enabled.count"] = secretScanEnabled

	MStatTotalServiceAccounts.Set(float64(storeStats.ServiceAccounts))
	MStatTotalServiceAccountsNoRole.Set(float64(storeStats.ServiceAccountsWithNoRole))
	MStatTotalServiceAccountTokens.Set(float64(storeStats.Tokens))

	return stats, nil
}
