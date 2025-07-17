package remote

import (
	"context"
	"fmt"
	"sync"
	"time"

	alertingNotify "github.com/grafana/alerting/notify"

	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
)

type configStore interface {
	GetLatestAlertmanagerConfiguration(ctx context.Context, orgID int64) (*models.AlertConfiguration, error)
}

//go:generate mockery --name remoteAlertmanager --structname RemoteAlertmanagerMock --with-expecter --output mock --outpkg alertmanager_mock
type remoteAlertmanager interface {
	notifier.Alertmanager
	CompareAndSendConfiguration(context.Context, *models.AlertConfiguration) error
	GetRemoteState(context.Context) (notifier.ExternalState, error)
	SendState(context.Context) error
}

type RemoteSecondaryForkedAlertmanager struct {
	log   log.Logger
	orgID int64
	store configStore

	internal notifier.Alertmanager
	remote   remoteAlertmanager

	lastSync     time.Time
	syncInterval time.Duration

	shouldFetchRemoteState bool
}

type RemoteSecondaryConfig struct {
	Logger log.Logger
	OrgID  int64
	Store  configStore

	// SyncInterval determines how often we should attempt to synchronize
	// the configuration on the remote Alertmanager.
	SyncInterval time.Duration

	// WithRemoteState is used to fetch and merge the state from the remote Alertmanager before starting the internal one.
	WithRemoteState bool
}

func (c *RemoteSecondaryConfig) Validate() error {
	if c.Logger == nil {
		return fmt.Errorf("logger cannot be nil")
	}
	return nil
}

func NewRemoteSecondaryForkedAlertmanager(cfg RemoteSecondaryConfig, internal notifier.Alertmanager, remote remoteAlertmanager) (*RemoteSecondaryForkedAlertmanager, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	return &RemoteSecondaryForkedAlertmanager{
		log:                    cfg.Logger,
		orgID:                  cfg.OrgID,
		store:                  cfg.Store,
		internal:               internal,
		remote:                 remote,
		syncInterval:           cfg.SyncInterval,
		shouldFetchRemoteState: cfg.WithRemoteState,
	}, nil
}

// ApplyConfig will only log errors for the remote Alertmanager and ensure we delegate the call to the internal Alertmanager.
// We don't care about errors in the remote Alertmanager in remote secondary mode.
func (fam *RemoteSecondaryForkedAlertmanager) ApplyConfig(ctx context.Context, config *models.AlertConfiguration) error {
	var wg sync.WaitGroup
	wg.Add(1)
	// Figure out if we need to sync the external Alertmanager in another goroutine.
	go func() {
		defer wg.Done()
		// If the Alertmanager has not been marked as "ready" yet, delegate the call to the remote Alertmanager.
		// This will perform a readiness check and sync the Alertmanagers.
		if !fam.remote.Ready() {
			if err := fam.remote.ApplyConfig(ctx, config); err != nil {
				fam.log.Error("Error applying config to the remote Alertmanager", "err", err)
				return
			}
			fam.lastSync = time.Now()
			return
		}

		// If the Alertmanager was marked as ready but the sync interval has elapsed, sync the Alertmanagers.
		if time.Since(fam.lastSync) >= fam.syncInterval {
			fam.log.Debug("Syncing configuration with the remote Alertmanager", "lastSync", fam.lastSync)
			if err := fam.remote.CompareAndSendConfiguration(ctx, config); err != nil {
				fam.log.Error("Unable to upload the configuration to the remote Alertmanager", "err", err)
			} else {
				fam.lastSync = time.Now()
			}
			fam.log.Debug("Finished syncing configuration with the remote Alertmanager")
		}
	}()

	if fam.shouldFetchRemoteState {
		wg.Wait()
		if !fam.remote.Ready() {
			return fmt.Errorf("remote Alertmanager not ready, can't fetch remote state")
		}
		// Pull and merge the remote Alertmanager state.
		rs, err := fam.remote.GetRemoteState(ctx)
		if err != nil {
			return fmt.Errorf("failed to fetch remote state: %w", err)
		}

		// The internal Alertmanager should implement the StateMerger interface.
		sm := fam.internal.(notifier.StateMerger)
		if err := sm.MergeState(rs); err != nil {
			return fmt.Errorf("failed to merge remote state: %w", err)
		}
		fam.log.Info("Successfully merged remote silences and nflog entries")

		// This operation should only be performed at startup.
		fam.shouldFetchRemoteState = false
	}

	// Call ApplyConfig on the internal Alertmanager - we only care about errors for this one.
	err := fam.internal.ApplyConfig(ctx, config)
	wg.Wait()
	return err
}

// SaveAndApplyConfig is only called on the internal Alertmanager when running in remote secondary mode.
func (fam *RemoteSecondaryForkedAlertmanager) SaveAndApplyConfig(ctx context.Context, config *apimodels.PostableUserConfig) error {
	return fam.internal.SaveAndApplyConfig(ctx, config)
}

// SaveAndApplyDefaultConfig is only called on the internal Alertmanager when running in remote secondary mode.
func (fam *RemoteSecondaryForkedAlertmanager) SaveAndApplyDefaultConfig(ctx context.Context) error {
	return fam.internal.SaveAndApplyDefaultConfig(ctx)
}

func (fam *RemoteSecondaryForkedAlertmanager) GetStatus(ctx context.Context) (apimodels.GettableStatus, error) {
	return fam.internal.GetStatus(ctx)
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

func (fam *RemoteSecondaryForkedAlertmanager) TestReceivers(ctx context.Context, c apimodels.TestReceiversConfigBodyParams) (*alertingNotify.TestReceiversResult, int, error) {
	return fam.internal.TestReceivers(ctx, c)
}

func (fam *RemoteSecondaryForkedAlertmanager) TestTemplate(ctx context.Context, c apimodels.TestTemplatesConfigBodyParams) (*notifier.TestTemplatesResults, error) {
	return fam.internal.TestTemplate(ctx, c)
}

func (fam *RemoteSecondaryForkedAlertmanager) SilenceState(ctx context.Context) (alertingNotify.SilenceState, error) {
	return fam.internal.SilenceState(ctx)
}

func (fam *RemoteSecondaryForkedAlertmanager) StopAndWait() {
	// Stop the internal Alertmanager.
	fam.internal.StopAndWait()
	// Stop our alert senders.
	fam.remote.StopAndWait()

	// Send config and state to the remote Alertmanager.
	// Using context.TODO() here as we think we want to allow this operation to finish regardless of time.
	ctx := context.TODO()
	if err := fam.remote.SendState(ctx); err != nil {
		fam.log.Error("Error sending state to the remote Alertmanager while stopping", "err", err)
	}

	config, err := fam.store.GetLatestAlertmanagerConfiguration(ctx, fam.orgID)
	if err != nil {
		fam.log.Error("Error getting latest Alertmanager configuration while stopping", "err", err)
		return
	}
	if err := fam.remote.CompareAndSendConfiguration(ctx, config); err != nil {
		fam.log.Error("Error sending configuration to the remote Alertmanager while stopping", "err", err)
	}
}

func (fam *RemoteSecondaryForkedAlertmanager) Ready() bool {
	// We only care about the internal Alertmanager being ready.
	return fam.internal.Ready()
}
