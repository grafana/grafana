package remote

import (
	"context"
	"fmt"
	"sync"

	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
)

type RemotePrimaryForkedAlertmanager struct {
	log log.Logger
	mtx sync.Mutex

	internal notifier.Alertmanager
	remote   remoteAlertmanager

	currentConfigHash string
}

func NewRemotePrimaryForkedAlertmanager(log log.Logger, internal notifier.Alertmanager, remote remoteAlertmanager) *RemotePrimaryForkedAlertmanager {
	return &RemotePrimaryForkedAlertmanager{
		log:      log,
		internal: internal,
		remote:   remote,
	}
}

// ApplyConfig will send the configuration to the remote Alertmanager on startup and on change.
// The call is always first delegated to the internal Alertmanager.
func (fam *RemotePrimaryForkedAlertmanager) ApplyConfig(ctx context.Context, config *models.AlertConfiguration) error {
	if err := fam.internal.ApplyConfig(ctx, config); err != nil {
		return fmt.Errorf("failed to call ApplyConfig on the internal Alertmanager: %w", err)
	}

	fam.mtx.Lock()
	defer fam.mtx.Unlock()
	if !fam.remote.Ready() {
		// On startup, ApplyConfig will perform a readiness check and sync the Alertmanagers.
		if err := fam.remote.ApplyConfig(ctx, config); err != nil {
			return fmt.Errorf("failed to call ApplyConfig on the remote Alertmanager: %w", err)
		}
		fam.currentConfigHash = config.ConfigurationHash
		return nil
	}

	// If the remote Alertmanager was ready and the configuration changed, send it.
	if config.ConfigurationHash != fam.currentConfigHash {
		fam.log.Info("Configuration has changed, sending it to the remote Alertmanager")
		if err := fam.remote.DecryptAndSendConfiguration(ctx, config); err != nil {
			return fmt.Errorf("failed to send config to the remote Alertmanager: %w", err)
		}
		fam.currentConfigHash = config.ConfigurationHash
	} else {
		fam.log.Debug("Configuration has not changed, skipping sending it to the remote Alertmanager")
	}
	return nil
}

// TODO: save the new configuration hash in memory.
func (fam *RemotePrimaryForkedAlertmanager) SaveAndApplyConfig(ctx context.Context, config *apimodels.PostableUserConfig) error {
	if err := fam.internal.SaveAndApplyConfig(ctx, config); err != nil {
		return err
	}

	return fam.remote.SaveAndApplyConfig(ctx, config)
}

// TODO: save the new configuration hash in memory.
func (fam *RemotePrimaryForkedAlertmanager) SaveAndApplyDefaultConfig(ctx context.Context) error {
	// Do nothing on the remote Alertmanager side, it will receive a configuration on startup or config change.
	return fam.internal.SaveAndApplyDefaultConfig(ctx)
}

func (fam *RemotePrimaryForkedAlertmanager) GetStatus() apimodels.GettableStatus {
	fmt.Println("forked.GetStatus()")
	return fam.remote.GetStatus()
}

func (fam *RemotePrimaryForkedAlertmanager) CreateSilence(ctx context.Context, silence *apimodels.PostableSilence) (string, error) {
	// Create que silence in the remote Alertmanager.
	_, err := fam.remote.CreateSilence(ctx, silence)
	if err != nil {
		return "", fmt.Errorf("failed to create silence in the remote Alertmanager: %w", err)
	}

	// Use the returned ID to create a silence in the internal Alertmanager.
	// TODO: refactor silence creation to be able to specify the ID.
	return fam.internal.CreateSilence(ctx, silence)
}

func (fam *RemotePrimaryForkedAlertmanager) DeleteSilence(ctx context.Context, id string) error {
	if err := fam.remote.DeleteSilence(ctx, id); err != nil {
		return fmt.Errorf("failed to delete silence in the remote Alertmanager: %w", err)
	}
	// TODO: use the same uid to delete the silence in the internal Alertmanager.
	if err := fam.internal.DeleteSilence(ctx, id); err != nil {
		// If deleting the silence fails in the internal Alertmanager, log it and return nil.
		fam.log.Error("Error deleting silence in the internal Alertmanager", "id", id, "err", err)
	}
	return nil
}

func (fam *RemotePrimaryForkedAlertmanager) GetSilence(ctx context.Context, id string) (apimodels.GettableSilence, error) {
	return fam.remote.GetSilence(ctx, id)
}

func (fam *RemotePrimaryForkedAlertmanager) ListSilences(ctx context.Context, filter []string) (apimodels.GettableSilences, error) {
	return fam.remote.ListSilences(ctx, filter)
}

func (fam *RemotePrimaryForkedAlertmanager) GetAlerts(ctx context.Context, active, silenced, inhibited bool, filter []string, receiver string) (apimodels.GettableAlerts, error) {
	return fam.remote.GetAlerts(ctx, active, silenced, inhibited, filter, receiver)
}

func (fam *RemotePrimaryForkedAlertmanager) GetAlertGroups(ctx context.Context, active, silenced, inhibited bool, filter []string, receiver string) (apimodels.AlertGroups, error) {
	return fam.remote.GetAlertGroups(ctx, active, silenced, inhibited, filter, receiver)
}

func (fam *RemotePrimaryForkedAlertmanager) PutAlerts(ctx context.Context, alerts apimodels.PostableAlerts) error {
	return fam.remote.PutAlerts(ctx, alerts)
	// TODO: no-op sender for internal.
}

func (fam *RemotePrimaryForkedAlertmanager) GetReceivers(ctx context.Context) ([]apimodels.Receiver, error) {
	return fam.remote.GetReceivers(ctx)
}

func (fam *RemotePrimaryForkedAlertmanager) TestReceivers(ctx context.Context, c apimodels.TestReceiversConfigBodyParams) (*notifier.TestReceiversResult, error) {
	return fam.remote.TestReceivers(ctx, c)
}

func (fam *RemotePrimaryForkedAlertmanager) TestTemplate(ctx context.Context, c apimodels.TestTemplatesConfigBodyParams) (*notifier.TestTemplatesResults, error) {
	return fam.remote.TestTemplate(ctx, c)
}

func (fam *RemotePrimaryForkedAlertmanager) CleanUp() {
	// No cleanup to do in the remote Alertmanager.
	fam.internal.CleanUp()
}

func (fam *RemotePrimaryForkedAlertmanager) StopAndWait() {
	fam.internal.StopAndWait()
	fam.remote.StopAndWait()
}

func (fam *RemotePrimaryForkedAlertmanager) Ready() bool {
	// Both Alertmanagers must be ready.
	if ready := fam.remote.Ready(); !ready {
		return false
	}
	return fam.internal.Ready()
}
