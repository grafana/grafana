package queryhistory

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"time"

	"github.com/grafana/grafana-app-sdk/k8s"
	sdkresource "github.com/grafana/grafana-app-sdk/resource"
	collectionsv1alpha1 "github.com/grafana/grafana/apps/collections/pkg/apis/collections/v1alpha1"
	qhv0alpha1 "github.com/grafana/grafana/apps/queryhistory/pkg/apis/queryhistory/v0alpha1"
	queryhistoryapp "github.com/grafana/grafana/apps/queryhistory/pkg/app"
	restclient "k8s.io/client-go/rest"
)

const (
	defaultReconcileInterval = 5 * time.Minute

	queryHistoryGroup = "queryhistory.grafana.app"
	queryHistoryKind  = "QueryHistory"
)

// StarsTTLReconciler periodically reconciles the star-count and expires-at labels
// on QueryHistory resources by reading the source of truth from Collections Stars.
//
// On star: increment star-count. If 0→1, remove expires-at label.
// On unstar: decrement star-count. If 1→0, set expires-at to now + 14 days.
type StarsTTLReconciler struct {
	logger      *slog.Logger
	qhClient    *qhv0alpha1.QueryHistoryClient
	starsClient *collectionsv1alpha1.StarsClient
	interval    time.Duration
	restConfig  *restclient.Config
}

func NewStarsTTLReconciler() *StarsTTLReconciler {
	return &StarsTTLReconciler{
		logger: slog.Default().With("component", "queryhistory-stars-reconciler"),
	}
}

func (r *StarsTTLReconciler) SetRestConfig(cfg restclient.Config) {
	r.restConfig = &cfg
}

// Run runs the reconciler loop. Called from the PostStartHook.
func (r *StarsTTLReconciler) Run(ctx context.Context) error {
	if r.restConfig != nil {
		gen := k8s.NewClientRegistry(*r.restConfig, k8s.DefaultClientConfig())
		if r.qhClient == nil {
			client, err := qhv0alpha1.NewQueryHistoryClientFromGenerator(gen)
			if err != nil {
				return fmt.Errorf("failed to create query history client: %w", err)
			}
			r.qhClient = client
		}
		if r.starsClient == nil {
			client, err := collectionsv1alpha1.NewStarsClientFromGenerator(gen)
			if err != nil {
				return fmt.Errorf("failed to create stars client: %w", err)
			}
			r.starsClient = client
		}
	}

	r.logger.Info("starting stars-TTL reconciler for query history")

	interval := r.interval
	if interval == 0 {
		interval = defaultReconcileInterval
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			r.reconcile(ctx)
		}
	}
}

// reconcile builds a set of starred QueryHistory names from Collections Stars,
// then updates star-count and expires-at labels on QueryHistory resources.
func (r *StarsTTLReconciler) reconcile(ctx context.Context) {
	if r.starsClient == nil {
		return
	}

	// Build a map of queryhistory resource name → star count across all users.
	starCounts, err := r.collectStarCounts(ctx)
	if err != nil {
		r.logger.Error("failed to collect star counts", "error", err)
		return
	}

	// List all QueryHistory resources that have a star-count label
	// and reconcile against the computed counts.
	r.reconcileLabels(ctx, starCounts)
}

// collectStarCounts lists all Stars resources and returns a map of
// QueryHistory resource name → total star count.
func (r *StarsTTLReconciler) collectStarCounts(ctx context.Context) (map[string]int, error) {
	counts := map[string]int{}
	continueToken := ""

	for {
		starsList, err := r.starsClient.List(ctx, "", sdkresource.ListOptions{
			Limit:    100,
			Continue: continueToken,
		})
		if err != nil {
			return nil, err
		}

		for i := range starsList.Items {
			for _, res := range starsList.Items[i].Spec.Resource {
				if res.Group == queryHistoryGroup && res.Kind == queryHistoryKind {
					for _, name := range res.Names {
						counts[name]++
					}
				}
			}
		}

		continueToken = starsList.GetContinue()
		if continueToken == "" {
			break
		}
	}

	return counts, nil
}

// reconcileLabels updates QueryHistory resources whose star-count label
// differs from the computed star counts.
func (r *StarsTTLReconciler) reconcileLabels(ctx context.Context, starCounts map[string]int) {
	updated := 0
	continueToken := ""

	for {
		list, err := r.qhClient.List(ctx, "", sdkresource.ListOptions{
			LabelFilters: []string{queryhistoryapp.LabelStarCount},
			Limit:        100,
			Continue:     continueToken,
		})
		if err != nil {
			r.logger.Error("failed to list query history resources for reconciliation", "error", err)
			return
		}

		for i := range list.Items {
			item := &list.Items[i]
			name := item.GetName()
			labels := item.GetLabels()
			if labels == nil {
				labels = make(map[string]string)
			}

			currentCount := 0
			if v, ok := labels[queryhistoryapp.LabelStarCount]; ok {
				currentCount, _ = strconv.Atoi(v)
			}

			targetCount := starCounts[name]
			// Remove from map so we can process remaining (newly starred) later
			delete(starCounts, name)

			if currentCount == targetCount {
				continue
			}

			labels, ttlChanged := updateStarCount(labels, targetCount-currentCount)
			if ttlChanged {
				if targetCount > 0 {
					labels = removeExpiresAt(labels)
				} else {
					labels = setExpiresAt(labels, queryhistoryapp.DefaultTTL)
				}
			}

			item.SetLabels(labels)
			if _, err := r.qhClient.Update(ctx, item, sdkresource.UpdateOptions{}); err != nil {
				r.logger.Error("failed to update star-count label", "name", name, "error", err)
				continue
			}
			updated++
		}

		continueToken = list.GetContinue()
		if continueToken == "" {
			break
		}
	}

	// Handle newly starred resources that don't yet have a star-count label.
	for name, count := range starCounts {
		if count <= 0 {
			continue
		}
		item, err := r.qhClient.Get(ctx, sdkresource.Identifier{Name: name})
		if err != nil {
			r.logger.Warn("failed to get query history resource for star update", "name", name, "error", err)
			continue
		}

		labels := item.GetLabels()
		if labels == nil {
			labels = make(map[string]string)
		}
		labels[queryhistoryapp.LabelStarCount] = strconv.Itoa(count)
		labels = removeExpiresAt(labels)
		item.SetLabels(labels)

		if _, err := r.qhClient.Update(ctx, item, sdkresource.UpdateOptions{}); err != nil {
			r.logger.Error("failed to set star-count on newly starred resource", "name", name, "error", err)
			continue
		}
		updated++
	}

	if updated > 0 {
		r.logger.Info("stars-TTL reconciliation complete", "updated", updated)
	}
}

// setExpiresAt sets the grafana.app/expires-at label to the given duration from now.
func setExpiresAt(labels map[string]string, duration time.Duration) map[string]string {
	if labels == nil {
		labels = make(map[string]string)
	}
	labels[queryhistoryapp.LabelExpiresAt] = strconv.FormatInt(time.Now().Add(duration).Unix(), 10)
	return labels
}

// removeExpiresAt removes the grafana.app/expires-at label.
func removeExpiresAt(labels map[string]string) map[string]string {
	delete(labels, queryhistoryapp.LabelExpiresAt)
	return labels
}

// updateStarCount adjusts the star-count label and returns the new count.
// Returns whether the TTL should be updated (transition across 0 boundary).
func updateStarCount(labels map[string]string, delta int) (newLabels map[string]string, ttlChanged bool) {
	if labels == nil {
		labels = make(map[string]string)
	}

	count := 0
	if v, ok := labels[queryhistoryapp.LabelStarCount]; ok {
		count, _ = strconv.Atoi(v)
	}

	oldCount := count
	count += delta
	if count < 0 {
		count = 0
	}

	labels[queryhistoryapp.LabelStarCount] = strconv.Itoa(count)

	// Transition across the 0 boundary means TTL state should change
	ttlChanged = (oldCount == 0 && count > 0) || (oldCount > 0 && count == 0)
	return labels, ttlChanged
}
