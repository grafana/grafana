package remote

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
)

type configStore interface {
	GetLatestAlertmanagerConfiguration(ctx context.Context, query *models.GetLatestAlertmanagerConfigurationQuery) (*models.AlertConfiguration, error)
}

type RemoteSecondaryForkedAlertmanager struct {
	log   log.Logger
	orgID int64
	store configStore

	lastSync     time.Time
	syncInterval time.Duration

	internal notifier.Alertmanager
	remote   notifier.Alertmanager
}

func NewRemoteSecondaryForkedAlertmanager(l log.Logger, orgID int64, syncInterval time.Duration, store configStore, internal, remote notifier.Alertmanager) *RemoteSecondaryForkedAlertmanager {
	return &RemoteSecondaryForkedAlertmanager{
		log:          l,
		orgID:        orgID,
		store:        store,
		syncInterval: syncInterval,
		internal:     internal,
		remote:       remote,
	}
}

func (fam *RemoteSecondaryForkedAlertmanager) ApplyConfig(ctx context.Context, config *models.AlertConfiguration) error {
	if time.Since(fam.lastSync) >= fam.syncInterval {
		fam.log.Debug("Applying config to the remote Alertmanager", "lastSync", fam.lastSync, "syncInterval", fam.syncInterval)
		if err := fam.remote.ApplyConfig(ctx, config); err != nil {
			fam.log.Error("Error applying config to the remote Alertmanager", "err", err)
		} else {
			fam.lastSync = time.Now()
		}
	}
	return fam.internal.ApplyConfig(ctx, config)
}

func (fam *RemoteSecondaryForkedAlertmanager) SaveAndApplyConfig(ctx context.Context, config *apimodels.PostableUserConfig) error {
	return nil
}

func (fam *RemoteSecondaryForkedAlertmanager) SaveAndApplyDefaultConfig(ctx context.Context) error {
	return nil
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

func (fam *RemoteSecondaryForkedAlertmanager) StopAndWait(ctx context.Context) {
	// Stop the internal Alertmanager.
	fam.internal.StopAndWait(ctx)
	// Stop our alert senders.
	fam.remote.StopAndWait(ctx)

	// Send config and state to the remote Alertmanager.
	config, err := fam.store.GetLatestAlertmanagerConfiguration(ctx, &models.GetLatestAlertmanagerConfigurationQuery{
		OrgID: fam.orgID,
	})
	if err != nil {
		fam.log.Error("Error getting latest Alertmanager configuration", "err", err)
		return
	}
	if err := fam.remote.ApplyConfig(ctx, config); err != nil {
		fam.log.Error("Error sending config and state to the remote Alertmanager", "err", err)
	}
}

func (fam *RemoteSecondaryForkedAlertmanager) Ready() bool {
	// Both Alertmanagers must be ready.
	if ready := fam.remote.Ready(); !ready {
		return false
	}
	return fam.internal.Ready()
}
