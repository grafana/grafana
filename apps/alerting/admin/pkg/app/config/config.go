package config

import (
	"context"
)

// RuntimeConfig carries the in-process dependencies the admin app needs at
// runtime. Wired by the parent process (pkg/registry/apps/alerting/admin)
// at registration time so the admin app's submodule stays free of
// grafana-parent imports.
type RuntimeConfig struct {
	// ValidateExternalSyncDatasource is the admission check for
	// spec.externalAlertmanagerSync.datasourceUid. Implementation lives in
	// the parent process where the datasource service is in scope. Return
	// nil to allow; non-nil error rejects with the error's message. Nil
	// function skips validation (test paths).
	ValidateExternalSyncDatasource func(ctx context.Context, uid string) error
}
