package queryhistory

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"time"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/resource"
	qhv0alpha1 "github.com/grafana/grafana/apps/queryhistory/pkg/apis/queryhistory/v0alpha1"
	restclient "k8s.io/client-go/rest"
)

const defaultCleanupInterval = 1 * time.Hour

type CleanupJob struct {
	logger     *slog.Logger
	interval   time.Duration
	client     *qhv0alpha1.QueryHistoryClient
	restConfig *restclient.Config
}

func NewCleanupJob() *CleanupJob {
	return &CleanupJob{
		logger: slog.Default().With("component", "queryhistory-cleanup"),
	}
}

func (c *CleanupJob) SetRestConfig(cfg restclient.Config) {
	c.restConfig = &cfg
}

func isExpired(expiresAtUnix int64) bool {
	if expiresAtUnix == 0 {
		return false
	}
	return time.Now().Unix() > expiresAtUnix
}

// Run is called periodically by the PostStartHook goroutine.
func (c *CleanupJob) Run(ctx context.Context) error {
	if c.client == nil && c.restConfig != nil {
		gen := k8s.NewClientRegistry(*c.restConfig, k8s.DefaultClientConfig())
		client, err := qhv0alpha1.NewQueryHistoryClientFromGenerator(gen)
		if err != nil {
			return fmt.Errorf("failed to create query history client: %w", err)
		}
		c.client = client
	}

	interval := c.interval
	if interval == 0 {
		interval = defaultCleanupInterval
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			c.cleanup(ctx)
		}
	}
}

func (c *CleanupJob) cleanup(ctx context.Context) {
	c.logger.Info("running query history TTL cleanup")

	deleted := 0
	continueToken := ""

	for {
		list, err := c.client.List(ctx, "", resource.ListOptions{
			LabelFilters: []string{LabelExpiresAt},
			Limit:        100,
			Continue:     continueToken,
		})
		if err != nil {
			c.logger.Error("failed to list query history resources for cleanup", "error", err)
			return
		}

		for i := range list.Items {
			item := &list.Items[i]
			labels := item.GetLabels()
			expiresAtStr, ok := labels[LabelExpiresAt]
			if !ok {
				continue
			}

			expiresAtUnix, err := strconv.ParseInt(expiresAtStr, 10, 64)
			if err != nil {
				c.logger.Warn("invalid expires-at label value", "name", item.GetName(), "value", expiresAtStr)
				continue
			}

			if isExpired(expiresAtUnix) {
				err := c.client.Delete(ctx, resource.Identifier{
					Namespace: item.GetNamespace(),
					Name:      item.GetName(),
				}, resource.DeleteOptions{})
				if err != nil {
					c.logger.Error("failed to delete expired query history", "name", item.GetName(), "error", err)
					continue
				}
				deleted++
			}
		}

		continueToken = list.GetContinue()
		if continueToken == "" {
			break
		}
	}

	c.logger.Info("query history TTL cleanup complete", "deleted", deleted)
}
