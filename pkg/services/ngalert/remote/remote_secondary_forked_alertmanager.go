package remote

import (
	"context"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
)

type RemoteSecondaryForkedAlertmanager struct {
	internal notifier.Alertmanager
	remote   notifier.Alertmanager
}

func NewRemoteSecondaryForkedAlertmanager(internal, remote notifier.Alertmanager) *RemoteSecondaryForkedAlertmanager {
	return &RemoteSecondaryForkedAlertmanager{
		internal: internal,
		remote:   remote,
	}
}

func (fam *RemoteSecondaryForkedAlertmanager) ApplyConfig(ctx context.Context, config *models.AlertConfiguration) error {
	return nil
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

func (fam *RemoteSecondaryForkedAlertmanager) StopAndWait() {
	fam.internal.StopAndWait()
	fam.remote.StopAndWait()
}

func (fam *RemoteSecondaryForkedAlertmanager) Ready() bool {
	// Both Alertmanagers must be ready.
	if ready := fam.remote.Ready(); !ready {
		return false
	}
	return fam.internal.Ready()
}
