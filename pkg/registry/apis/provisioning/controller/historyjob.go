package controller

import (
	"fmt"
	"time"

	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	versioned "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
)

// ProvideHistoryJobCleanup builds the historic-job cleanup pipeline shared by the
// provisioning API server and the standalone jobs operator: a HistoryJobController
// registered on the historic-job DeltaSource selected by natsEnabled. Cleanup is
// age-based, so expiration is both the age past which jobs are deleted and the
// source's resync period.
//
// The returned source is not started; the caller owns its lifecycle and must call
// Run. Callers decide whether cleanup is enabled and how a non-positive
// expiration is handled.
func ProvideHistoryJobCleanup(natsEnabled bool, client versioned.Interface, expiration time.Duration) (informer.DeltaSource, error) {
	historyJobController := appcontroller.NewHistoryJobController(client.ProvisioningV0alpha1(), expiration)
	source := informer.NewHistoricJobDeltaSource(natsEnabled, client, expiration)
	if _, err := source.AddEventHandler(historyJobController.EventHandler()); err != nil {
		return nil, fmt.Errorf("add history job controller event handler: %w", err)
	}
	return source, nil
}
