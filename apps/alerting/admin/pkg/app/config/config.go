package config

import (
	"context"
)

// RuntimeConfig carries the in-process dependencies the admin app needs at
// runtime. Wired by the parent process (pkg/registry/apps/alerting/admin)
// at registration time so the admin app's submodule stays free of
// grafana-parent imports.
type RuntimeConfig struct {
	// ValidateExternalSyncDatasource validates that the given datasource UID
	// is acceptable as spec.externalAlertmanagerSync.datasourceUid for the
	// org carried in ctx. Called from the AlertingConfig admission validator
	// on every create/update.
	//
	// Implementations should check:
	//   - the sync feature flag is enabled (otherwise reject writes that
	//     introduce a UID — the value would have no effect),
	//   - the datasource exists in the request's org,
	//   - the datasource type is alertmanager,
	//   - its JsonData.implementation is in the syncable allow-list.
	//
	// Return nil on success; return an error to reject the admission
	// request. Nil function means validation is skipped (e.g. test paths).
	ValidateExternalSyncDatasource func(ctx context.Context, uid string) error
}
