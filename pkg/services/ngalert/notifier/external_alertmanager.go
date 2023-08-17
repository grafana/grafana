package notifier

import (
	"context"

	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type configStore interface {
	GetLatestAlertmanagerConfiguration(ctx context.Context, query *models.GetLatestAlertmanagerConfigurationQuery) (*models.AlertConfiguration, error)
}

type externalAlertmanager struct {
	log      log.Logger
	url      string
	tenantID string
	store    configStore
	// TODO: add client
}

type ExternalAlertmanagerConfig struct {
	URL               string
	BasicAuthUser     string
	BasicAuthPassword string
	TenantID          string
}

func (am *externalAlertmanager) AlertmanagerFor(orgID int64) (Alertmanager, error) {
	if orgID == 1 {
		return am, nil
	}
	return nil, ErrNoAlertmanagerForOrg
}

// LoadAndSyncAlertmanagersForOrgs sends the Grafana Alerting configuration over to the external Alertmanager.
func (am *externalAlertmanager) LoadAndSyncAlertmanagersForOrgs(ctx context.Context) error {
	return nil
}

// Run is a no-op.
func (*externalAlertmanager) Run(ctx context.Context) error {
	return nil
}

// Note: feature not available in Mimir.
func (*externalAlertmanager) ActivateHistoricalConfiguration(ctx context.Context, orgId int64, id int64) error {
	return nil
}

// GetAlertmanagerConfiguration retrieves the tenant's current configuration from the external Alertmanager.
func (am *externalAlertmanager) GetAlertmanagerConfiguration(ctx context.Context, org int64) (apimodels.GettableUserConfig, error) {
	return apimodels.GettableUserConfig{}, nil
}

// GetAppliedAlertmanagerConfigurations returns the last n configurations marked as applied for a given tenant.
// Note: feature not available in Mimir.
func (*externalAlertmanager) GetAppliedAlertmanagerConfigurations(ctx context.Context, org int64, limit int) ([]*apimodels.GettableHistoricUserConfig, error) {
	return []*apimodels.GettableHistoricUserConfig{}, nil
}

// ApplyAlertmanagerConfiguration updates the configuration on the external Alertmanager.
func (am *externalAlertmanager) ApplyAlertmanagerConfiguration(ctx context.Context, org int64, config apimodels.PostableUserConfig) error {
	return nil
}

func (am *externalAlertmanager) SaveAndApplyConfig(ctx context.Context, config *apimodels.PostableUserConfig) error {
	return nil
}

func (am *externalAlertmanager) SaveAndApplyDefaultConfig(ctx context.Context) error {
	return nil
}

func (am *externalAlertmanager) GetStatus() apimodels.GettableStatus {
	return apimodels.GettableStatus{}
}

func (am *externalAlertmanager) CreateSilence(ps *apimodels.PostableSilence) (string, error) {
	return "", nil
}

func (am *externalAlertmanager) DeleteSilence(silenceID string) error {
	return nil
}

func (am *externalAlertmanager) GetSilence(silenceID string) (apimodels.GettableSilence, error) {
	return apimodels.GettableSilence{}, nil
}

func (am *externalAlertmanager) ListSilences(filter []string) (apimodels.GettableSilences, error) {
	return apimodels.GettableSilences{}, nil
}

func (am *externalAlertmanager) GetAlerts(active, silenced, inhibited bool, filter []string, receiver string) (apimodels.GettableAlerts, error) {
	return apimodels.GettableAlerts{}, nil
}

func (am *externalAlertmanager) GetAlertGroups(active, silenced, inhibited bool, filter []string, receiver string) (apimodels.AlertGroups, error) {
	return apimodels.AlertGroups{}, nil
}

func (am *externalAlertmanager) PutAlerts(postableAlerts apimodels.PostableAlerts) error {
	return nil
}

func (am *externalAlertmanager) GetReceivers(ctx context.Context) []apimodels.Receiver {
	return []apimodels.Receiver{}
}

func (am *externalAlertmanager) TestReceivers(ctx context.Context, c apimodels.TestReceiversConfigBodyParams) (*TestReceiversResult, error) {
	return &TestReceiversResult{}, nil
}

func (am *externalAlertmanager) TestTemplate(ctx context.Context, c apimodels.TestTemplatesConfigBodyParams) (*TestTemplatesResults, error) {
	return &alertingNotify.TestTemplatesResults{}, nil
}

func (am *externalAlertmanager) ConfigHash() [16]byte {
	return [16]byte{}
}

func (am *externalAlertmanager) OrgID() int64 {
	return 1
}
