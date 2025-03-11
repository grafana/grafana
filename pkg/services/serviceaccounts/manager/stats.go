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

	// MStatTotalMigratedAPIKeysToSATokens is a metric gauge for total number of API keys to be migrated to service account tokens
	MStatTotalMigratedAPIKeysToSATokens prometheus.Gauge

	// MStatSuccessfullyMigratedAPIKeysToSATokens is a metric gauge for total number of successful migrations of API keys to service account tokens
	MStatSuccessfullyMigratedAPIKeysToSATokens prometheus.Gauge

	// MStatFailedMigratedAPIKeysToSATokens is a metric gauge for total number of failed migrations of API keys to service account tokens
	MStatFailedMigratedAPIKeysToSATokens prometheus.Gauge

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

	MStatTotalMigratedAPIKeysToSATokens = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_total_migrated_api_keys_to_sa_tokens",
		Help:      "total number of API keys to be migrated to service account tokens",
		Namespace: ExporterName,
	})

	MStatSuccessfullyMigratedAPIKeysToSATokens = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_successfully_migrated_api_keys_to_sa_tokens",
		Help:      "total number of successful migrations of API keys to service account tokens",
		Namespace: ExporterName,
	})

	MStatFailedMigratedAPIKeysToSATokens = prometheus.NewGauge(prometheus.GaugeOpts{
		Name:      "stat_failed_migrated_api_keys_to_sa_tokens",
		Help:      "total number of failed migrations of API keys to service account tokens",
		Namespace: ExporterName,
	})

	prometheus.MustRegister(
		MStatTotalServiceAccounts,
		MStatTotalServiceAccountTokens,
		MStatTotalServiceAccountsNoRole,
		MStatTotalMigratedAPIKeysToSATokens,
		MStatSuccessfullyMigratedAPIKeysToSATokens,
		MStatFailedMigratedAPIKeysToSATokens,
	)
}

func (sa *ServiceAccountsService) getUsageMetrics(ctx context.Context) (map[string]any, error) {
	stats := map[string]any{}

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

func setAPIKeyMigrationStats(total, migrated, failed int) {
	MStatTotalMigratedAPIKeysToSATokens.Set(float64(total))
	MStatSuccessfullyMigratedAPIKeysToSATokens.Set(float64(migrated))
	MStatFailedMigratedAPIKeysToSATokens.Set(float64(failed))
}
