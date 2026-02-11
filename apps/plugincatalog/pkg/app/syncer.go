package app

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/wait"

	plugincatalogv0alpha1 "github.com/grafana/grafana/apps/plugincatalog/pkg/apis/plugincatalog/v0alpha1"
)

const (
	managedByLabel     = "app.kubernetes.io/managed-by"
	managedByValue     = "plugincatalog-sync"
	maxConflictRetries = 3
)

// CatalogSyncer syncs plugin catalog data from grafana.com
type CatalogSyncer struct {
	fetcher      PluginCatalogFetcher
	pluginClient *plugincatalogv0alpha1.PluginClient
	config       Config
	log          logging.Logger
}

// NewCatalogSyncer creates a new catalog syncer
func NewCatalogSyncer(fetcher PluginCatalogFetcher, pluginClient *plugincatalogv0alpha1.PluginClient, config Config) *CatalogSyncer {
	return &CatalogSyncer{fetcher: fetcher, pluginClient: pluginClient, config: config}
}

// Run implements app.Runnable
func (s *CatalogSyncer) Run(ctx context.Context) error {
	s.log = logging.FromContext(ctx).With("component", "catalog-syncer")
	s.log.Info("Starting catalog syncer", "interval", s.config.SyncInterval)

	if err := s.sync(ctx); err != nil {
		s.log.Error("Initial sync failed", "error", err)
	}

	ticker := time.NewTicker(s.config.SyncInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			s.log.Info("Catalog syncer shutting down")
			return nil
		case <-ticker.C:
			if err := s.sync(ctx); err != nil {
				s.log.Error("Sync failed", "error", err)
			}
		}
	}
}

func (s *CatalogSyncer) sync(ctx context.Context) error {
	plugins, err := s.fetchWithRetry(ctx)
	if err != nil {
		return err
	}
	s.log.Info("Fetched plugins", "count", len(plugins))

	synced := make(map[string]struct{}, len(plugins))
	var errs int
	for slug, p := range plugins {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		if err := s.createOrUpdate(ctx, slug, p); err != nil {
			s.log.Warn("Failed to sync plugin", "slug", slug, "error", err)
			errs++
			continue
		}
		synced[slug] = struct{}{}
	}
	s.log.Info("Sync completed", "success", len(synced), "errors", errs)

	if s.config.CleanupStale {
		if err := s.cleanupStale(ctx, synced); err != nil {
			s.log.Warn("Cleanup failed", "error", err)
		}
	}
	return nil
}

func (s *CatalogSyncer) fetchWithRetry(ctx context.Context) (map[string]Plugin, error) {
	backoff := wait.Backoff{
		Duration: time.Second,
		Factor:   2.0,
		Jitter:   0.1,
		Steps:    s.config.MaxRetries,
		Cap:      30 * time.Second,
	}

	var plugins map[string]Plugin
	var attempt int
	err := wait.ExponentialBackoff(backoff, func() (bool, error) {
		attempt++
		if ctx.Err() != nil {
			return false, ctx.Err()
		}

		var err error
		plugins, err = s.fetcher.GetPlugins(ctx, "catalog-sync")
		if err == nil {
			return true, nil
		}

		s.log.Warn("Fetch failed, retrying", "attempt", attempt, "error", err)
		return false, nil // retry
	})
	if err != nil {
		return nil, fmt.Errorf("failed after %d attempts: %w", attempt, err)
	}
	return plugins, nil
}

func (s *CatalogSyncer) createOrUpdate(ctx context.Context, slug string, p Plugin) error {
	plugin := &plugincatalogv0alpha1.Plugin{
		ObjectMeta: metav1.ObjectMeta{
			Name:   slug,
			Labels: map[string]string{managedByLabel: managedByValue},
		},
		Spec: plugincatalogv0alpha1.PluginSpec{
			Slug:          p.Slug,
			Status:        p.Status,
			SignatureType: p.SignatureType,
		},
	}

	for attempt := 1; attempt <= maxConflictRetries; attempt++ {
		existing, err := s.pluginClient.Get(ctx, resource.Identifier{Name: slug})
		if apierrors.IsNotFound(err) {
			_, err = s.pluginClient.Create(ctx, plugin, resource.CreateOptions{})
			if err == nil || !apierrors.IsAlreadyExists(err) {
				return err
			}
			continue // race: retry to get the created resource
		}
		if err != nil {
			return err
		}

		// Check if update needed
		if existing.Spec == plugin.Spec {
			return nil
		}

		plugin.ObjectMeta.ResourceVersion = existing.ObjectMeta.ResourceVersion
		plugin.ObjectMeta.UID = existing.ObjectMeta.UID

		if _, err = s.pluginClient.Update(ctx, plugin, resource.UpdateOptions{}); err == nil {
			return nil
		} else if !apierrors.IsConflict(err) {
			return err
		}
	}
	return fmt.Errorf("conflict after %d retries", maxConflictRetries)
}

func (s *CatalogSyncer) cleanupStale(ctx context.Context, synced map[string]struct{}) error {
	var continueToken string
	for {
		list, err := s.pluginClient.List(ctx, "", resource.ListOptions{Limit: 500, Continue: continueToken})
		if err != nil {
			return err
		}

		for _, p := range list.Items {
			if _, exists := synced[p.Name]; exists {
				continue
			}
			if p.Labels[managedByLabel] != managedByValue {
				continue
			}
			if err := s.pluginClient.Delete(ctx, resource.Identifier{Name: p.Name}, resource.DeleteOptions{}); err != nil {
				s.log.Error("Failed to delete stale plugin", "name", p.Name, "error", err)
				continue
			}
			s.log.Debug("Deleted stale plugin", "name", p.Name)
		}

		if continueToken = list.ListMeta.Continue; continueToken == "" {
			return nil
		}
	}
}
