package app

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	upgradesv0alpha1 "github.com/grafana/grafana/apps/upgrades/pkg/apis/upgrades/v0alpha1"
	"github.com/grafana/grafana/pkg/util"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type VersionChecker struct {
	log    logging.Logger
	client resource.Client
}

func NewVersionChecker(log logging.Logger, client resource.Client) *VersionChecker {
	return &VersionChecker{
		log:    log,
		client: client,
	}
}

func (v *VersionChecker) Run(ctx context.Context) error {
	logger := v.log.WithContext(ctx)
	logger.Debug("Starting version cron")

	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			logger.Info("Inserting fake upgrade metadata")
			objName := fmt.Sprintf("fake-upgrade-%s", util.GenerateShortUID())
			upgradeMetadata := &upgradesv0alpha1.UpgradeMetadata{
				ObjectMeta: metav1.ObjectMeta{
					Name:      objName,
					Namespace: "default",
				},
				Spec: upgradesv0alpha1.UpgradeMetadataSpec{
					StartingVersion: "1.0.0",
					TargetVersion:   "1.0.1",
					State:           "new",
				},
			}
			_, err := v.client.Create(ctx, upgradeMetadata.GetStaticMetadata().Identifier(), upgradeMetadata, resource.CreateOptions{})
			if err != nil {
				logger.Error("Error creating upgrade metadata", "error", err)
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}
