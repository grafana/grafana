package remote

import (
	"context"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
)

//go:generate mockery --name remoteAlertmanager --structname RemoteAlertmanagerMock --with-expecter --output mock --outpkg alertmanager_mock
type remoteAlertmanager interface {
	notifier.Alertmanager
	CompareAndSendConfiguration(context.Context, *models.AlertConfiguration) error
	CompareAndSendState(context.Context) error
}

type RemoteSecondaryForkedAlertmanager struct {
	log log.Logger

	internal notifier.Alertmanager
	remote   remoteAlertmanager

	mtx           sync.RWMutex
	currentConfig *models.AlertConfiguration
	syncCancel    func()
}

func NewRemoteSecondaryForkedAlertmanager(l log.Logger, syncInterval time.Duration, internal notifier.Alertmanager, remote remoteAlertmanager) *RemoteSecondaryForkedAlertmanager {
	ctx, cancel := context.WithCancel(context.Background())
	fam := RemoteSecondaryForkedAlertmanager{
		log:        l,
		internal:   internal,
		remote:     remote,
		syncCancel: cancel,
	}

	// Start the routine to sync configuration and state.
	go fam.syncRoutine(ctx, syncInterval)
	return &fam
}

// ApplyConfig will only log errors for the remote Alertmanager and ensure we delegate the call to the internal Alertmanager.
// We don't care about errors in the remote Alertmanager in remote secondary mode.
func (fam *RemoteSecondaryForkedAlertmanager) ApplyConfig(ctx context.Context, config *models.AlertConfiguration) error {
	// Save the config in memory to use it in our sync routine.
	fam.mtx.Lock()
	fam.currentConfig = config
	fam.mtx.Unlock()

	if err := fam.remote.ApplyConfig(ctx, config); err != nil {
		fam.log.Error("Error applying config to the remote Alertmanager", "err", err)
	}
	return fam.internal.ApplyConfig(ctx, config)
}

// SaveAndApplyConfig is only called on the internal Alertmanager when running in remote secondary mode.
func (fam *RemoteSecondaryForkedAlertmanager) SaveAndApplyConfig(ctx context.Context, config *apimodels.PostableUserConfig) error {
	return fam.internal.SaveAndApplyConfig(ctx, config)
}

// SaveAndApplyDefaultConfig is only called on the internal Alertmanager when running in remote secondary mode.
func (fam *RemoteSecondaryForkedAlertmanager) SaveAndApplyDefaultConfig(ctx context.Context) error {
	return fam.internal.SaveAndApplyDefaultConfig(ctx)
}

func (fam *RemoteSecondaryForkedAlertmanager) GetStatus() apimodels.GettableStatus {
	return fam.internal.GetStatus()
}

func (fam *RemoteSecondaryForkedAlertmanager) CreateSilence(ctx context.Context, silence *apimodels.PostableSilence) (string, error) {
	return fam.internal.CreateSilence(ctx, silence)
}

func (fam *RemoteSecondaryForkedAlertmanager) DeleteSilence(ctx context.Context, id string) error {
	return fam.internal.DeleteSilence(ctx, id)
}

func (fam *RemoteSecondaryForkedAlertmanager) GetSilence(ctx context.Context, id string) (apimodels.GettableSilence, error) {
	return fam.internal.GetSilence(ctx, id)
}

func (fam *RemoteSecondaryForkedAlertmanager) ListSilences(ctx context.Context, filter []string) (apimodels.GettableSilences, error) {
	return fam.internal.ListSilences(ctx, filter)
}

func (fam *RemoteSecondaryForkedAlertmanager) GetAlerts(ctx context.Context, active, silenced, inhibited bool, filter []string, receiver string) (apimodels.GettableAlerts, error) {
	return fam.internal.GetAlerts(ctx, active, silenced, inhibited, filter, receiver)
}

func (fam *RemoteSecondaryForkedAlertmanager) GetAlertGroups(ctx context.Context, active, silenced, inhibited bool, filter []string, receiver string) (apimodels.AlertGroups, error) {
	return fam.internal.GetAlertGroups(ctx, active, silenced, inhibited, filter, receiver)
}

func (fam *RemoteSecondaryForkedAlertmanager) PutAlerts(ctx context.Context, alerts apimodels.PostableAlerts) error {
	return fam.internal.PutAlerts(ctx, alerts)
}

func (fam *RemoteSecondaryForkedAlertmanager) GetReceivers(ctx context.Context) ([]apimodels.Receiver, error) {
	return fam.internal.GetReceivers(ctx)
}

func (fam *RemoteSecondaryForkedAlertmanager) TestReceivers(ctx context.Context, c apimodels.TestReceiversConfigBodyParams) (*notifier.TestReceiversResult, error) {
	return fam.internal.TestReceivers(ctx, c)
}

func (fam *RemoteSecondaryForkedAlertmanager) TestTemplate(ctx context.Context, c apimodels.TestTemplatesConfigBodyParams) (*notifier.TestTemplatesResults, error) {
	return fam.internal.TestTemplate(ctx, c)
}

func (fam *RemoteSecondaryForkedAlertmanager) CleanUp() {
	// No cleanup to do in the remote Alertmanager.
	fam.internal.CleanUp()
}

func (fam *RemoteSecondaryForkedAlertmanager) StopAndWait() {
	fam.internal.StopAndWait()
	fam.remote.StopAndWait()

	// Stop our routine to sync configuration and state.
	fam.syncCancel()
}

func (fam *RemoteSecondaryForkedAlertmanager) Ready() bool {
	// Both Alertmanagers must be ready.
	if ready := fam.remote.Ready(); !ready {
		return false
	}
	return fam.internal.Ready()
}

func (fam *RemoteSecondaryForkedAlertmanager) syncRoutine(ctx context.Context, interval time.Duration) {
	fam.log.Debug("Starting sync routine")
	ticker := time.NewTicker(interval)
	for {
		select {
		case <-ticker.C:
			fam.mtx.RLock()
			// TODO(santiago): check...
			// No va a funcionar porque no va a ser la última config en caso de cambio...
			config := *fam.currentConfig
			fam.mtx.RUnlock()

			fam.log.Debug("Syncing configuration and state with the remote Alertmanager")
			if err := fam.remote.CompareAndSendConfiguration(ctx, &config); err != nil {
				fam.log.Error("Unable to upload the configuration to the remote Alertmanager", "err", err)
			}
			if err := fam.remote.CompareAndSendState(ctx); err != nil {
				fam.log.Error("Unable to upload the state to the remote Alertmanager", "err", err)
			}
			fam.log.Debug("Finished syncing configuration and state with the remote Alertmanager")

		case <-ctx.Done():
			// TODO: send state and config on shutdown.
			fam.log.Debug("Terminating sync routine")
			return
		}
	}
}
