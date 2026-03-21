package queryhistory

import (
	"context"
	"log/slog"
	"strconv"
	"time"
)

const (
	LabelCreatedBy     = "grafana.app/created-by"
	LabelDatasourceUID = "grafana.app/datasource-uid"
	LabelExpiresAt     = "grafana.app/expires-at"
	LabelStarCount     = "grafana.app/star-count"
	DefaultTTL         = 14 * 24 * time.Hour
)

// StarsTTLReconciler watches Collections Stars resources and updates
// the grafana.app/star-count and grafana.app/expires-at labels on
// QueryHistory resources using a reference count approach.
//
// On star: increment star-count. If 0→1, remove expires-at label.
// On unstar: decrement star-count. If 1→0, set expires-at to now + 14 days.
//
// The star count is a derived value — Collections holds the source of truth.
// A slight drift is benign: worst case is a delayed cleanup, not data loss.
type StarsTTLReconciler struct {
	logger *slog.Logger
	// TODO: add Collections Stars client for listing/watching Stars resources
	// TODO: add QueryHistory client for getting/updating QueryHistory resources
}

// Start runs the reconciler loop. Called from the PostStartHook.
// Currently a placeholder — the implementation requires wiring the
// Collections Stars client and a QueryHistory resource client, which
// depend on the PostStartHook loopback client config.
func (r *StarsTTLReconciler) Start(ctx context.Context) error {
	r.logger.Info("starting stars-TTL reconciler for query history")

	// The reconciler will:
	// 1. Watch/poll Collections Stars resources for changes
	// 2. On each change, diff the previous/current spec.resource[].names
	//    for group=queryhistory.grafana.app, kind=QueryHistory
	// 3. For each newly starred UID:
	//    - Get the QueryHistory resource
	//    - Increment grafana.app/star-count label
	//    - If transitioning 0→1: remove grafana.app/expires-at label
	//    - Update the resource
	// 4. For each newly unstarred UID:
	//    - Get the QueryHistory resource
	//    - Decrement grafana.app/star-count label
	//    - If transitioning 1→0: set grafana.app/expires-at to now + DefaultTTL
	//    - Update the resource

	<-ctx.Done()
	return nil
}

// setExpiresAt sets the grafana.app/expires-at label to the given duration from now.
func setExpiresAt(labels map[string]string, duration time.Duration) map[string]string {
	if labels == nil {
		labels = make(map[string]string)
	}
	labels[LabelExpiresAt] = strconv.FormatInt(time.Now().Add(duration).Unix(), 10)
	return labels
}

// removeExpiresAt removes the grafana.app/expires-at label.
func removeExpiresAt(labels map[string]string) map[string]string {
	delete(labels, LabelExpiresAt)
	return labels
}

// updateStarCount adjusts the star-count label and returns the new count.
// Returns whether the TTL should be updated (transition across 0 boundary).
func updateStarCount(labels map[string]string, delta int) (newLabels map[string]string, ttlChanged bool) {
	if labels == nil {
		labels = make(map[string]string)
	}

	count := 0
	if v, ok := labels[LabelStarCount]; ok {
		count, _ = strconv.Atoi(v)
	}

	oldCount := count
	count += delta
	if count < 0 {
		count = 0
	}

	labels[LabelStarCount] = strconv.Itoa(count)

	// Transition across the 0 boundary means TTL state should change
	ttlChanged = (oldCount == 0 && count > 0) || (oldCount > 0 && count == 0)
	return labels, ttlChanged
}
