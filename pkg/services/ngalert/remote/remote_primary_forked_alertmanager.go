package remote

import (
	"context"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
)

type RemotePrimaryForkedAlertmanager struct {
	internal notifier.Alertmanager
	remote   notifier.Alertmanager
}

func NewRemotePrimaryForkedAlertmanager(internal, remote notifier.Alertmanager) *RemotePrimaryForkedAlertmanager {
	return &RemotePrimaryForkedAlertmanager{
		internal: internal,
		remote:   remote,
	}
}

func (fam *RemotePrimaryForkedAlertmanager) ApplyConfig(ctx context.Context, config *models.AlertConfiguration) error {
	return nil
}

func (fam *RemotePrimaryForkedAlertmanager) SaveAndApplyConfig(ctx context.Context, config *apimodels.PostableUserConfig) error {
	return nil
}

func (fam *RemotePrimaryForkedAlertmanager) SaveAndApplyDefaultConfig(ctx context.Context) error {
	return nil
}

func (fam *RemotePrimaryForkedAlertmanager) GetStatus() apimodels.GettableStatus {
	return fam.remote.GetStatus()
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
