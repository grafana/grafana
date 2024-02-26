package remote

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
)

type RemotePrimaryForkedAlertmanager struct {
	log   log.Logger
	orgID int64
	store configStore

	internal notifier.Alertmanager
	remote   remoteAlertmanager

	currentConfig string
}

type RemotePrimaryConfig struct {
	Logger log.Logger
	OrgID  int64
	Store  configStore
}

func (c *RemotePrimaryConfig) Validate() error {
	if c.Logger == nil {
		return fmt.Errorf("logger cannot be nil")
	}
	return nil
}

func NewRemotePrimaryForkedAlertmanager(cfg RemotePrimaryConfig, internal notifier.Alertmanager, remote remoteAlertmanager) (*RemotePrimaryForkedAlertmanager, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	return &RemotePrimaryForkedAlertmanager{
		log:   cfg.Logger,
		orgID: cfg.OrgID,
		store: cfg.Store,

		internal: internal,
		remote:   remote,
	}, nil
}

// ApplyConfig calls ApplyConfig on the remote Alertmanager in case the config has changed.
// This way we send the configuration on startup and config change.
// It then calls ApplyConfig on the internal Alertmanager.
func (fam *RemotePrimaryForkedAlertmanager) ApplyConfig(ctx context.Context, config *models.AlertConfiguration) error {
	// ApplyConfig will perform a readiness check and sync the Alertmanagers.
	// Note: we don't really need this check, the remote AM struct checks the readiness on every call.
	if !fam.remote.Ready() {
		if err := fam.remote.ApplyConfig(ctx, config); err != nil {
			// In remote primary mode we care about errors in the remote Alertmanager.
			return fmt.Errorf("failed to call ApplyConfig on the remote Alertmanager: %w", err)
		}
		fam.currentConfig = config.ConfigurationHash
	}

	// If the configuration has changed, we need to send it to the remote Alertmanager.
	if config.ConfigurationHash != fam.currentConfig {
		fam.log.Info("Configuration has changed, sending it to the remote Alertmanager")
		if err := fam.remote.SendConfiguration(ctx, config); err != nil {
			return fmt.Errorf("failed to send config to the remote Alertmanager: %w", err)
		}
		fam.currentConfig = config.ConfigurationHash
	} else {
		fam.log.Debug("Configuration has not changed, skipping sending it to the remote Alertmanager")
	}

	return fam.internal.ApplyConfig(ctx, config)
}

func (fam *RemotePrimaryForkedAlertmanager) SaveAndApplyConfig(ctx context.Context, config *apimodels.PostableUserConfig) error {
	rawConfig, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to serialize to the Alertmanager configuration: %w", err)
	}

	cmd := &models.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration: string(rawConfig),
		Default:                   false,
		ConfigurationVersion:      fmt.Sprintf("v%d", models.AlertConfigurationVersion),
		OrgID:                     fam.orgID,
		LastApplied:               time.Now().UTC().Unix(),
	}

	// TODO: what if we fail in the remote Alertmanager but not here?
	dbCfg, err := fam.store.SaveAlertmanagerConfiguration(ctx, cmd)
	if err != nil {
		return err
	}

	// Note: the id is always 1 when there's only one org.
	dbCfg.ID = 1
	if err := fam.remote.SendConfiguration(ctx, dbCfg); err != nil {
		return fmt.Errorf("failed to send config to the remote Alertmanager: %w", err)
	}
	fam.currentConfig = dbCfg.ConfigurationHash
	return nil
}

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
