package reconciler

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

const (
	// StateKVOrgID and StateKVNamespace address the reconciler's records in
	// Grafana's kv_store table. Reconciliation state is not org-scoped, so it
	// uses org 0 like the unified storage dualwrite state does.
	StateKVOrgID     int64 = 0
	StateKVNamespace       = "zanzana.reconciler"

	// stateVersion identifies the expected-tuple computation. Bump it whenever
	// a change makes tuples written by earlier versions wrong, so that every
	// namespace reconciles on its next authorization request instead of waiting
	// out the reconciler interval.
	stateVersion = 1
)

// StateStore persists which namespaces have been reconciled, keyed by
// namespace. It is satisfied by *kvstore.NamespacedKVStore.
type StateStore interface {
	Get(ctx context.Context, key string) (string, bool, error)
	Set(ctx context.Context, key string, value string) error
	Del(ctx context.Context, key string) error
}

// namespaceState records a completed reconciliation. Its purpose is to identify
// the store the tuples were written to: the record lives in Grafana's database
// while the tuples live in Zanzana's, and the two can diverge — the OpenFGA
// migrations drop and rebuild their tables when the goose schema is
// inconsistent, on the grounds that Zanzana holds derived state.
type namespaceState struct {
	StoreID string `json:"store_id"`
	// ModelID is diagnostic only. GetStore and ListAllStores leave it empty, so
	// comparing it would force a reconcile after every process start.
	ModelID      string `json:"model_id"`
	ReconciledAt int64  `json:"reconciled_at"`
	Version      int    `json:"version"`
}

// describes reports whether the record was written for the store that exists
// now, by an expected-tuple computation at least as new as this process's.
//
// A newer version counts as reconciled so that during a rolling deploy that
// bumps stateVersion, replicas still running the old binary leave namespaces
// the new ones have reconciled alone rather than reverting their tuples. A
// rollback recovers on its own: the leader's periodic pass reconciles every
// store regardless of its record and rewrites the record with its own version.
func (s namespaceState) describes(store *zanzana.StoreInfo) bool {
	return s.Version >= stateVersion && s.StoreID != "" && s.StoreID == store.ID
}

// isReconciled reports whether namespace can be served without reconciling it
// first. A store existing is not evidence of reconciliation: the user and org
// mutation hooks write tuples through GetOrCreateStore, so a store can exist
// for a namespace whose role bindings were never computed.
func (r *Reconciler) isReconciled(ctx context.Context, namespace string, store *zanzana.StoreInfo) bool {
	if store == nil {
		return false
	}

	if r.stateStore == nil {
		// Callers that run a reconciler are required to supply one; treat its
		// absence the way an empty record is treated rather than as evidence
		// that the namespace is reconciled.
		return false
	}

	state, ok, err := r.readState(ctx, namespace)
	if err != nil {
		// An unreadable record is treated as absent: reconciling a namespace
		// twice is harmless, skipping it leaves users without permissions.
		r.logger.Warn("Failed to read reconciliation state", "namespace", namespace, "error", err)
		r.metrics.errorsTotal.WithLabelValues("read_state").Inc()
		return false
	}

	return ok && state.describes(store)
}

func (r *Reconciler) readState(ctx context.Context, namespace string) (namespaceState, bool, error) {
	raw, ok, err := r.stateStore.Get(ctx, namespace)
	if err != nil {
		return namespaceState{}, false, err
	}
	if !ok {
		return namespaceState{}, false, nil
	}

	var state namespaceState
	if err := json.Unmarshal([]byte(raw), &state); err != nil {
		return namespaceState{}, false, fmt.Errorf("failed to decode reconciliation state: %w", err)
	}

	return state, true, nil
}

// markReconciled records that namespace is reconciled against its current
// store. Failing to record is logged but not fatal: the namespace stays
// correct, it just gets reconciled again after the next process start.
func (r *Reconciler) markReconciled(ctx context.Context, namespace string) {
	if r.stateStore == nil {
		return
	}

	store, err := r.server.GetStore(ctx, namespace)
	if err != nil || store == nil {
		r.logger.Warn("Skipping reconciliation state write, store unavailable", "namespace", namespace, "error", err)
		return
	}

	raw, err := json.Marshal(namespaceState{
		StoreID:      store.ID,
		ModelID:      store.ModelID,
		ReconciledAt: time.Now().Unix(),
		Version:      stateVersion,
	})
	if err != nil {
		r.logger.Warn("Failed to encode reconciliation state", "namespace", namespace, "error", err)
		return
	}

	if err := r.stateStore.Set(ctx, namespace, string(raw)); err != nil {
		r.logger.Warn("Failed to write reconciliation state", "namespace", namespace, "error", err)
		r.metrics.errorsTotal.WithLabelValues("write_state").Inc()
	}
}

// clearReconciled drops the record for a namespace that no longer exists, so a
// namespace recreated under the same name reconciles from scratch.
func (r *Reconciler) clearReconciled(ctx context.Context, namespace string) {
	if r.stateStore == nil {
		return
	}

	if err := r.stateStore.Del(ctx, namespace); err != nil {
		r.logger.Warn("Failed to delete reconciliation state", "namespace", namespace, "error", err)
		r.metrics.errorsTotal.WithLabelValues("delete_state").Inc()
	}
}
