package rulesync

import "context"

// syncSpec holds the externalRulerSync spec fields the worker reads for one org.
type syncSpec struct {
	// DatasourceUID is the source Mimir/Cortex ruler datasource to sync from.
	DatasourceUID string
	// TargetDatasourceUID is where converted recording rules write their
	// results; empty means default to the query (source) datasource.
	TargetDatasourceUID string
	// Promote requests a one-way conversion of the synced rules into native
	// Grafana rules the org owns, after which sync stops.
	Promote bool
	// LastAppliedHash is the upstream config hash from the last successful sync;
	// lets the worker skip unchanged re-applies across restarts/replicas. Empty
	// if never synced.
	LastAppliedHash string
}

// rulesConfigStore reads the per-org externalRulerSync spec and records sync
// status. The syncer depends only on this interface so it stays free of the
// generated Config kind; the production, Config-backed implementation lives in
// the app-resource PR (#127756).
type rulesConfigStore interface {
	GetSyncSpec(ctx context.Context, orgID int64) (syncSpec, error)
	WriteStatus(ctx context.Context, orgID int64, outcome syncOutcome) error
}

// noopConfigStore drives the syncer from the ini setting alone: it reports no
// per-org config and drops status writes.
//
// TODO(app-resource PR #127756): replace with the rules-app Config store, which
// reads spec.externalRulerSync (datasource/target/promote + persisted dedup
// hash) and persists status.externalRulerSync.
type noopConfigStore struct{}

func (noopConfigStore) GetSyncSpec(context.Context, int64) (syncSpec, error) {
	return syncSpec{}, nil
}

func (noopConfigStore) WriteStatus(context.Context, int64, syncOutcome) error {
	return nil
}
