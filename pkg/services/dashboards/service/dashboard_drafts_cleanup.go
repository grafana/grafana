package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/org"
)

const dashboardDraftsCleanupLockName = "dashboard-drafts-cleanup"

var dashboardDraftsExpired = promauto.NewCounterVec(prometheus.CounterOpts{
	Namespace: "grafana",
	Name:      "dashboard_drafts_expired_total",
	Help:      "Dashboard drafts and forks moved to trash after going idle.",
}, []string{"lifecycle"})

// startDashboardDraftsCleanupJob moves dashboard drafts and forks that went without
// a write for [dashboard_drafts] idle_ttl to trash, where they stay restorable for
// the trash retention period. It runs whether or not the feature flag is on, so
// drafts created while it was on still expire after it is turned off.
func (dr *DashboardServiceImpl) startDashboardDraftsCleanupJob(ctx context.Context) chan struct{} {
	done := make(chan struct{})
	settings := dr.cfg.DashboardDrafts
	if settings.CleanupInterval <= 0 || dr.serverLockService == nil {
		close(done)
		return done
	}
	go func() {
		defer close(done)
		ticker := time.NewTicker(settings.CleanupInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				err := dr.serverLockService.LockAndExecute(ctx, dashboardDraftsCleanupLockName, settings.CleanupInterval, func(ctx context.Context) {
					if err := dr.cleanupExpiredDashboardDrafts(ctx, time.Now()); err != nil {
						dr.log.Error("Failed to clean up expired dashboard drafts", "error", err)
					}
				})
				if err != nil {
					dr.log.Error("Failed to run dashboard drafts cleanup", "error", err)
				}
			}
		}
	}()
	return done
}

func (dr *DashboardServiceImpl) cleanupExpiredDashboardDrafts(ctx context.Context, now time.Time) error {
	ctx, span := tracer.Start(ctx, "dashboards.service.cleanupExpiredDashboardDrafts")
	defer span.End()

	orgs, err := dr.orgService.Search(ctx, &org.SearchOrgsQuery{})
	if err != nil {
		return err
	}
	var errs []error
	for _, o := range orgs {
		if ctx.Err() != nil {
			break
		}
		if err := dr.cleanupOrgExpiredDashboardDrafts(ctx, o.ID, now); err != nil {
			errs = append(errs, fmt.Errorf("org %d: %w", o.ID, err))
		}
	}
	return errors.Join(errs...)
}

func (dr *DashboardServiceImpl) cleanupOrgExpiredDashboardDrafts(ctx context.Context, orgID int64, now time.Time) error {
	ctx, _ = identity.WithServiceIdentity(ctx, orgID)
	cutoff := now.Add(-dr.cfg.DashboardDrafts.IdleTTL)
	continueToken := ""
	var expired []*unstructured.Unstructured
	for {
		list, err := dr.k8sclient.List(ctx, orgID, v1.ListOptions{
			LabelSelector: fmt.Sprintf("%s in (%s,%s)", utils.LabelKeyLifecycle, utils.LifecycleDraft, utils.LifecycleFork),
			Limit:         dr.cfg.DashboardDrafts.BatchSize,
			Continue:      continueToken,
		})
		if err != nil {
			return err
		}
		for i := range list.Items {
			if isIdleDraft(&list.Items[i], cutoff) {
				expired = append(expired, &list.Items[i])
			}
		}
		continueToken = list.GetContinue()
		if continueToken == "" {
			break
		}
	}

	var errs []error
	for _, item := range expired {
		if err := dr.k8sclient.Delete(ctx, item.GetName(), orgID, v1.DeleteOptions{}); err != nil {
			errs = append(errs, fmt.Errorf("deleting %s: %w", item.GetName(), err))
			continue
		}
		dashboardDraftsExpired.WithLabelValues(item.GetLabels()[utils.LabelKeyLifecycle]).Inc()
		dr.log.Info("Moved idle dashboard draft to trash", "orgID", orgID, "uid", item.GetName(), "lifecycle", item.GetLabels()[utils.LabelKeyLifecycle])
	}
	return errors.Join(errs...)
}

// isIdleDraft reports whether a draft or fork has gone without a write since cutoff.
func isIdleDraft(item *unstructured.Unstructured, cutoff time.Time) bool {
	lifecycle := item.GetLabels()[utils.LabelKeyLifecycle]
	if lifecycle != utils.LifecycleDraft && lifecycle != utils.LifecycleFork {
		return false
	}
	meta, err := utils.MetaAccessor(item)
	if err != nil {
		return false
	}
	last := item.GetCreationTimestamp().Time
	if updated, err := meta.GetUpdatedTimestamp(); err == nil && updated != nil && updated.After(last) {
		last = *updated
	}
	return !last.IsZero() && last.Before(cutoff)
}
