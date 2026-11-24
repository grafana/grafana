package controller

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"

	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
)

// ProvideHistoryJobCleanup builds the historic-job cleanup pipeline shared by the
// provisioning API server and the standalone jobs operator: a HistoryJobController
// registered on the historic-job DeltaSource the supplier selects. Cleanup is
// age-based, so expiration is both the age past which jobs are deleted and the
// source's resync period. Deletes run under ctx, which should be the context the
// source runs under so shutdown also cancels in-flight deletes.
//
// The returned source is not started; the caller owns its lifecycle and must call
// Run. Callers decide whether cleanup is enabled and how a non-positive
// expiration is handled.
func ProvideHistoryJobCleanup(ctx context.Context, supplier operator.InformerSupplier, clients resource.ClientGenerator, client versioned.Interface, expiration time.Duration) (informer.DeltaSource, error) {
	historyJobController := appcontroller.NewHistoryJobController(client.ProvisioningV0alpha1(), expiration)
	source, err := informer.NewHistoricJobDeltaSource(supplier, clients, expiration)
	if err != nil {
		return nil, fmt.Errorf("historic job source: %w", err)
	}
	if _, err := source.AddEventHandler(historyJobController.EventHandler(ctx)); err != nil {
		return nil, fmt.Errorf("add history job controller event handler: %w", err)
	}
	return source, nil
}
