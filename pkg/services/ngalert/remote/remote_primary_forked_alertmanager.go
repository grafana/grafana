package remote

import (
	"context"
	"errors"
	"fmt"

	alertingNotify "github.com/grafana/alerting/notify"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
)

type RemotePrimaryForkedAlertmanager struct {
	log log.Logger

	internal notifier.Alertmanager
	remote   remoteAlertmanager
}

// NewRemotePrimaryFactory returns a function to override the default AM factory in the multi-org Alertmanager.
func NewRemotePrimaryFactory(
	cfg AlertmanagerConfig,
	store stateStore,
	crypto Crypto,
	autogenFn AutogenFn,
	m *metrics.RemoteAlertmanager,
	t tracing.Tracer,
) func(notifier.OrgAlertmanagerFactory) notifier.OrgAlertmanagerFactory {
	return func(factoryFn notifier.OrgAlertmanagerFactory) notifier.OrgAlertmanagerFactory {
		return func(ctx context.Context, orgID int64) (notifier.Alertmanager, error) {
			// Create the internal Alertmanager.
			internalAM, err := factoryFn(ctx, orgID)
			if err != nil {
				return nil, err
			}

			// Create the remote Alertmanager.
			cfg.OrgID = orgID
			l := log.New("ngalert.forked-alertmanager.remote-primary")
			remoteAM, err := NewAlertmanager(ctx, cfg, store, crypto, autogenFn, m, t, WithPromotedConfig)
			if err != nil {
				l.Error("Failed to create remote Alertmanager, falling back to using only the internal one", "err", err)
				return internalAM, nil
			}

			// Use both implementations in the forked Alertmanager.
			return newRemotePrimaryForkedAlertmanager(l, internalAM, remoteAM), nil
		}
	}
}

func newRemotePrimaryForkedAlertmanager(log log.Logger, internal notifier.Alertmanager, remote remoteAlertmanager) *RemotePrimaryForkedAlertmanager {
	return &RemotePrimaryForkedAlertmanager{
		log:      log,
		internal: internal,
		remote:   remote,
	}
}

// ApplyConfig will send the configuration to the remote Alertmanager on startup.
func (fam *RemotePrimaryForkedAlertmanager) ApplyConfig(ctx context.Context, config *models.AlertConfiguration) error {
	if err := fam.remote.ApplyConfig(ctx, config); err != nil {
		return fmt.Errorf("failed to call ApplyConfig on the remote Alertmanager: %w", err)
	}

	if err := fam.internal.ApplyConfig(ctx, config); err != nil {
		// An error in the internal Alertmanager shouldn't make the whole operation fail.
		// We're replicating writes in the internal Alertmanager just for comparing and in case we need to roll back.
		fam.log.Error("Error applying config to the internal Alertmanager", "err", err)
	}
	return nil
}

func (fam *RemotePrimaryForkedAlertmanager) SaveAndApplyConfig(ctx context.Context, config *apimodels.PostableUserConfig) error {
	if err := fam.remote.SaveAndApplyConfig(ctx, config); err != nil {
		return err
	}

	if err := fam.internal.SaveAndApplyConfig(ctx, config); err != nil {
		// An error in the internal Alertmanager shouldn't make the whole operation fail.
		// We're replicating writes in the internal Alertmanager just for comparing and in case we need to roll back.
		fam.log.Error("Error applying config to the internal Alertmanager", "err", err)
	}
	return nil
}

func (fam *RemotePrimaryForkedAlertmanager) SaveAndApplyDefaultConfig(ctx context.Context) error {
	if err := fam.remote.SaveAndApplyDefaultConfig(ctx); err != nil {
		return fmt.Errorf("failed to send the default configuration to the remote Alertmanager: %w", err)
	}

	if err := fam.internal.SaveAndApplyDefaultConfig(ctx); err != nil {
		// An error in the internal Alertmanager shouldn't make the whole operation fail.
		// We're replicating writes in the internal Alertmanager just for comparing and in case we need to roll back.
		fam.log.Error("Error applying the default configuration to the internal Alertmanager", "err", err)
	}
	return nil
}

func (fam *RemotePrimaryForkedAlertmanager) GetStatus(ctx context.Context) (apimodels.GettableStatus, error) {
	return fam.remote.GetStatus(ctx)
}

func (fam *RemotePrimaryForkedAlertmanager) CreateSilence(ctx context.Context, silence *apimodels.PostableSilence) (string, error) {
	originalID := silence.ID
	id, err := fam.remote.CreateSilence(ctx, silence)
	if err != nil {
		return "", err
	}

	if originalID != "" && originalID != id {
		// ID has changed, expire the old silence before creating a new one.
		if err := fam.internal.DeleteSilence(ctx, originalID); err != nil {
			if errors.Is(err, alertingNotify.ErrSilenceNotFound) {
				// This can happen if the silence was created in the remote AM without using the Grafana UI
				// in remote primary mode, or if the silence failed to be replicated in the internal AM.
				fam.log.Warn("Failed to delete silence in the internal Alertmanager", "err", err, "id", originalID)
			} else {
				fam.log.Error("Failed to delete silence in the internal Alertmanager", "err", err, "id", originalID)
			}
		}
	}

	silence.ID = id
	if _, err := fam.internal.CreateSilence(ctx, silence); err != nil {
		fam.log.Error("Error creating silence in the internal Alertmanager", "err", err, "silence", silence)
	}
	return id, nil
}

func (fam *RemotePrimaryForkedAlertmanager) DeleteSilence(ctx context.Context, id string) error {
	if err := fam.remote.DeleteSilence(ctx, id); err != nil {
		return err
	}
	if err := fam.internal.DeleteSilence(ctx, id); err != nil {
		fam.log.Error("Error deleting silence in the internal Alertmanager", "err", err, "id", id)
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
}

func (fam *RemotePrimaryForkedAlertmanager) GetReceivers(ctx context.Context) ([]apimodels.Receiver, error) {
	return fam.remote.GetReceivers(ctx)
}

func (fam *RemotePrimaryForkedAlertmanager) TestReceivers(ctx context.Context, c apimodels.TestReceiversConfigBodyParams) (*alertingNotify.TestReceiversResult, int, error) {
	return fam.remote.TestReceivers(ctx, c)
}

func (fam *RemotePrimaryForkedAlertmanager) TestTemplate(ctx context.Context, c apimodels.TestTemplatesConfigBodyParams) (*notifier.TestTemplatesResults, error) {
	return fam.remote.TestTemplate(ctx, c)
}

func (fam *RemotePrimaryForkedAlertmanager) SilenceState(ctx context.Context) (alertingNotify.SilenceState, error) {
	return fam.remote.SilenceState(ctx)
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
