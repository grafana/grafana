package remote

import (
	"context"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
)

type Mode int

const (
	ModeRemoteSecondary Mode = iota
	ModeRemotePrimary
)

type ForkedAlertmanager struct {
	internal notifier.Alertmanager
	remote   notifier.Alertmanager
	mode     Mode
}

func NewForkedAlertmanager(internal, remote notifier.Alertmanager, m Mode) *ForkedAlertmanager {
	return &ForkedAlertmanager{
		internal: internal,
		remote:   remote,
		mode:     m,
	}
}

func (fam *ForkedAlertmanager) ApplyConfig(ctx context.Context, config *models.AlertConfiguration) error {
	return nil
}

func (fam *ForkedAlertmanager) SaveAndApplyConfig(ctx context.Context, config *apimodels.PostableUserConfig) error {
	return nil
}

func (fam *ForkedAlertmanager) SaveAndApplyDefaultConfig(ctx context.Context) error {
	return nil
}

func (fam *ForkedAlertmanager) GetStatus() apimodels.GettableStatus {
	return apimodels.GettableStatus{}
}

func (fam *ForkedAlertmanager) CreateSilence(ctx context.Context, silence *apimodels.PostableSilence) (string, error) {
	return "", nil
}

func (fam *ForkedAlertmanager) DeleteSilence(ctx context.Context, id string) error {
	return nil
}

func (fam *ForkedAlertmanager) GetSilence(ctx context.Context, id string) (apimodels.GettableSilence, error) {
	return apimodels.GettableSilence{}, nil
}

func (fam *ForkedAlertmanager) ListSilences(ctx context.Context, filter []string) (apimodels.GettableSilences, error) {
	return apimodels.GettableSilences{}, nil
}

func (fam *ForkedAlertmanager) GetAlerts(ctx context.Context, active, silenced, inhibited bool, filter []string, receiver string) (apimodels.GettableAlerts, error) {
	return apimodels.GettableAlerts{}, nil
}

func (fam *ForkedAlertmanager) GetAlertGroups(ctx context.Context, active, silenced, inhibited bool, filter []string, receiver string) (apimodels.AlertGroups, error) {
	return apimodels.AlertGroups{}, nil
}

func (fam *ForkedAlertmanager) PutAlerts(ctx context.Context, alerts apimodels.PostableAlerts) error {
	return nil
}

func (fam *ForkedAlertmanager) GetReceivers(ctx context.Context) ([]apimodels.Receiver, error) {
	return []apimodels.Receiver{}, nil
}

func (fam *ForkedAlertmanager) TestReceivers(ctx context.Context, c apimodels.TestReceiversConfigBodyParams) (*notifier.TestReceiversResult, error) {
	return &notifier.TestReceiversResult{}, nil
}

func (fam *ForkedAlertmanager) TestTemplate(ctx context.Context, c apimodels.TestTemplatesConfigBodyParams) (*notifier.TestTemplatesResults, error) {
	return &notifier.TestTemplatesResults{}, nil
}

func (fam *ForkedAlertmanager) CleanUp() {}

func (fam *ForkedAlertmanager) StopAndWait() {}

func (fam *ForkedAlertmanager) Ready() bool {
	return false
}
