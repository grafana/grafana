package app

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"sort"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	upgradesv0alpha1 "github.com/grafana/grafana/apps/upgrades/pkg/apis/upgrades/v0alpha1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/klog/v2"
)

type UpgradesConfig struct {
	CurrentVersion string
}

func New(cfg app.Config) (app.App, error) {
	log := logging.DefaultLogger.With("app", "upgrades.app")
	clientGenerator := k8s.NewClientRegistry(cfg.KubeConfig, k8s.ClientConfig{})
	client, err := clientGenerator.ClientFor(upgradesv0alpha1.UpgradeMetadataKind())
	if err != nil {
		return nil, err
	}

	upgradesConfig, ok := cfg.SpecificConfig.(*UpgradesConfig)
	if !ok {
		return nil, fmt.Errorf("invalid config type %T", cfg.SpecificConfig)
	}

	simpleConfig := simple.AppConfig{
		Name:       "upgrades",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			ErrorHandler: func(ctx context.Context, err error) {
				klog.ErrorS(err, "Informer processing error")
			},
		},
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind: upgradesv0alpha1.UpgradeMetadataKind(),
				CustomRoutes: simple.AppCustomRouteHandlers{
					simple.AppCustomRoute{
						Method: simple.AppCustomRouteMethodGet,
						Path:   "checkForUpgrades",
					}: func(ctx context.Context, writer app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
						body, err := io.ReadAll(req.Body)
						if err != nil {
							return err
						}
						var reqBody struct {
							Limit int `json:"limit"`
						}
						err = json.Unmarshal(body, &reqBody)
						if err != nil {
							return err
						}

						metas, err := checkForUpgrades(ctx, client, reqBody.Limit)
						if err != nil {
							return err
						}
						b, err := json.Marshal(metas)
						if err != nil {
							return err
						}
						_, err = writer.Write(b)
						return err
					},
				},
			},
		},
	}

	a, err := simple.NewApp(simpleConfig)
	if err != nil {
		return nil, err
	}

	err = a.ValidateManifest(cfg.ManifestData)
	if err != nil {
		return nil, err
	}

	a.AddRunnable(NewVersionChecker(log, client, upgradesConfig.CurrentVersion))

	return a, nil
}

func GetKinds() map[schema.GroupVersion][]resource.Kind {
	gv := schema.GroupVersion{
		Group:   upgradesv0alpha1.UpgradeMetadataKind().Group(),
		Version: upgradesv0alpha1.UpgradeMetadataKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {upgradesv0alpha1.UpgradeMetadataKind()},
	}
}

// checkForUpgrades returns the first n new upgrade metadata objects
func checkForUpgrades(ctx context.Context, client resource.Client, limit int) ([]*upgradesv0alpha1.UpgradeMetadataSpec, error) {
	upgradeMetadataList, err := client.List(ctx, "default", resource.ListOptions{})
	if err != nil {
		return nil, err
	}

	metas := make([]*upgradesv0alpha1.UpgradeMetadata, len(upgradeMetadataList.GetItems()))
	for _, upgradeMetadata := range upgradeMetadataList.GetItems() {
		m, ok := upgradeMetadata.(*upgradesv0alpha1.UpgradeMetadata)
		if !ok {
			return nil, fmt.Errorf("upgrade metadata is not a *upgradesv0alpha1.UpgradeMetadata")
		}
		if m.Spec.State == "new" {
			metas = append(metas, m)
		}
	}

	// Sort by creation timestamp
	sort.SliceStable(metas, func(i, j int) bool {
		return metas[i].GetCommonMetadata().CreationTimestamp.Before(metas[j].GetCommonMetadata().CreationTimestamp)
	})

	specs := make([]*upgradesv0alpha1.UpgradeMetadataSpec, len(metas))
	for i, meta := range metas {
		specs[i] = &meta.Spec
	}

	// Return the first `limit` specs
	return specs[:limit], nil
}
