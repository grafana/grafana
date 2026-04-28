package remote

import (
	"context"
	"errors"
	"fmt"

	alertingModels "github.com/grafana/alerting/models"
	alertingNotify "github.com/grafana/alerting/notify"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
	store kvstore.KVStore,
	crypto Crypto,
	m *metrics.RemoteAlertmanager,
	t tracing.Tracer,
	features featuremgmt.FeatureToggles,
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
			cfg.PromoteConfig = true
			l := log.New("ngalert.forked-alertmanager.remote-primary")
			remoteAM, err := NewAlertmanager(ctx, cfg, notifier.NewFileStore(cfg.OrgID, store), crypto, m, t, features)
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
func (fam *RemotePrimaryForkedAlertmanager) ApplyConfig(ctx context.Context, config alertingNotify.NotificationsConfiguration) (bool, error) {
	applied, err := fam.remote.ApplyConfig(ctx, config)
	if err != nil {
		return false, fmt.Errorf("failed to call ApplyConfig on the remote Alertmanager: %w", err)
	}

	if _, err := fam.internal.ApplyConfig(ctx, config); err != nil {
		// An error in the internal Alertmanager shouldn't make the whole operation fail.
		// We're replicating writes in the internal Alertmanager just for comparing and in case we need to roll back.
		fam.log.Error("Error applying config to the internal Alertmanager", "err", err)
	}
	return applied, nil
}

func (fam *RemotePrimaryForkedAlertmanager) GetStatus(ctx context.Context) (apimodels.GettableStatus, error) {
	return fam.remote.GetStatus(ctx)
}

func (fam *RemotePrimaryForkedAlertmanager) CreateSilence(ctx context.Context, silence *apimodels.PostableSilence) (string, error) {
	return fam.remote.CreateSilence(ctx, silence)
}

func (fam *RemotePrimaryForkedAlertmanager) DeleteSilence(ctx context.Context, id string) error {
	return fam.remote.DeleteSilence(ctx, id)
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

func (fam *RemotePrimaryForkedAlertmanager) GetReceivers(ctx context.Context) ([]alertingModels.ReceiverStatus, error) {
	return fam.remote.GetReceivers(ctx)
}

func (fam *RemotePrimaryForkedAlertmanager) TestIntegration(ctx context.Context, receiverName string, integrationConfig models.Integration, alert alertingModels.TestReceiversConfigAlertParams) (alertingModels.IntegrationStatus, error) {
	return fam.remote.TestIntegration(ctx, receiverName, integrationConfig, alert)
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
