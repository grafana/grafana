package notifier

import (
	"context"
	"fmt"

	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/e2emimir"
)

type externalAlertmanager struct {
	url      string
	tenantID string
	client   *e2emimir.Client
}
type configStore interface {
	GetLatestAlertmanagerConfiguration(ctx context.Context, query *models.GetLatestAlertmanagerConfigurationQuery) (*models.AlertConfiguration, error)
}

// TODO: naming...
type externalMultiOrgAlertmanager struct {
	log log.Logger
	// Note: this is not multi-org! We're just creating one for the main org.
	alertmanager *externalAlertmanager
	store        configStore
}

type ExternalAlertmanagerConfig struct {
	URL               string
	BasicAuthUser     string
	BasicAuthPassword string
	TenantID          string
}

func NewExternalMultiOrgAlertmanager(cfg ExternalAlertmanagerConfig, store configStore, log log.Logger) (*externalMultiOrgAlertmanager, error) {
	amClient, err := e2emimir.NewClient(cfg.URL, cfg.TenantID, cfg.BasicAuthUser, cfg.BasicAuthPassword)
	if err != nil {
		return nil, fmt.Errorf("Error creating client: %w", err)
	}
	am := externalAlertmanager{
		url:      cfg.URL,
		tenantID: cfg.TenantID,
		client:   amClient,
	}

	return &externalMultiOrgAlertmanager{
		log:          log,
		store:        store,
		alertmanager: &am,
	}, nil
}

// TODO: we're completely ignoring orgID.
// TODO(santiago): implement.
func (am *externalMultiOrgAlertmanager) AlertmanagerFor(orgID int64) (Alertmanager, error) {
	// TODO: main OrgID always 1?
	fmt.Println("noop.AlertmanagerFor() called")
	if orgID == 1 {
		// TODO: I don't really need this layer of abstraction if we're not being multi-org.
		return am.alertmanager, nil
	}
	return nil, ErrNoAlertmanagerForOrg
}

// Note: we could use this to sync internal and external AM config.
func (am *externalMultiOrgAlertmanager) LoadAndSyncAlertmanagersForOrgs(ctx context.Context) error {
	fmt.Println("noop.LoadAndSyncAlertmanagersForOrgs() called")
	// TODO: pulling and merging config is done in the Cloud AM, we just push the config here.
	query := models.GetLatestAlertmanagerConfigurationQuery{
		OrgID: 1,
	}
	internalConfig, err := am.store.GetLatestAlertmanagerConfiguration(ctx, &query)
	if err != nil {
		return err
	}

	postableConfig, err := Load([]byte(internalConfig.AlertmanagerConfiguration))
	if err != nil {
		return err
	}
	// TODO: check if we need to update or if we already did.
	// Update external AM configuration.
	if err := am.alertmanager.client.SetAlertmanagerConfig(ctx, postableConfig); err != nil {
		fmt.Println("error sending config:", err)
		return err
	}

	return nil
}

// TODO(santiago): implement.
func (*externalMultiOrgAlertmanager) Run(ctx context.Context) error {
	fmt.Println("noop.Run() called")
	return nil
}

// TODO(santiago): implement.
func (*externalMultiOrgAlertmanager) ActivateHistoricalConfiguration(ctx context.Context, orgId int64, id int64) error {
	fmt.Println("noop.ActivateHistoricalConfiguration() called")
	return nil
}

func (am *externalMultiOrgAlertmanager) GetAlertmanagerConfiguration(ctx context.Context, org int64) (apimodels.GettableUserConfig, error) {
	fmt.Println("noop.GetAlertmanagerConfiguration() called")
	return am.alertmanager.client.GetAlertmanagerConfig(ctx)
}

// TODO(santiago): implement.
func (*externalMultiOrgAlertmanager) GetAppliedAlertmanagerConfigurations(ctx context.Context, org int64, limit int) ([]*apimodels.GettableHistoricUserConfig, error) {
	fmt.Println("noop.GetAppliedAlertmanagerConfigurations() called")
	return []*apimodels.GettableHistoricUserConfig{}, nil
}

func (am *externalMultiOrgAlertmanager) ApplyAlertmanagerConfiguration(ctx context.Context, org int64, config apimodels.PostableUserConfig) error {
	fmt.Println("noop.ApplyAlertmanagerConfiguration() called")
	return am.alertmanager.client.SetAlertmanagerConfig(ctx, &config)
}

// TODO(santiago): implement.
func (am *externalAlertmanager) ApplyConfig(ctx context.Context, config *models.AlertConfiguration) error {
	fmt.Println("externalAM.ApplyConfig() called")
	return nil
}

// TODO(santiago): implement.
func (am *externalAlertmanager) SaveAndApplyConfig(ctx context.Context, config *apimodels.PostableUserConfig) error {
	fmt.Println("externalAM.SaveAndApplyConfig() called")
	return nil
}

// TODO(santiago): implement.
func (am *externalAlertmanager) SaveAndApplyDefaultConfig(ctx context.Context) error {
	fmt.Println("externalAM.SaveAndApplyDefaultConfig() called")
	return nil
}

// TODO(santiago): implement.
func (am *externalAlertmanager) GetStatus() apimodels.GettableStatus {
	fmt.Println("externalAM.GetStatus() called")
	return apimodels.GettableStatus{}
}

// TODO(santiago): implement.
func (am *externalAlertmanager) CreateSilence(ps *apimodels.PostableSilence) (string, error) {
	fmt.Println("externalAM.CreateSilence() called")
	return "", nil
}

// TODO(santiago): implement.
func (am *externalAlertmanager) DeleteSilence(silenceID string) error {
	fmt.Println("externalAM.DeleteSilence() called")
	return nil
}

// TODO(santiago): implement.
func (am *externalAlertmanager) GetSilence(silenceID string) (apimodels.GettableSilence, error) {
	fmt.Println("externalAM.GetSilence() called")
	return apimodels.GettableSilence{}, nil
}

// TODO(santiago): filters.
func (am *externalAlertmanager) ListSilences(filter []string) (apimodels.GettableSilences, error) {
	fmt.Println("externalAM.ListSilences() called")
	return am.client.GetSilencesV2(context.TODO())
}

// TODO(santiago): implement.
func (am *externalAlertmanager) GetAlerts(active, silenced, inhibited bool, filter []string, receiver string) (apimodels.GettableAlerts, error) {
	fmt.Println("externalAM.GetAlerts() called")
	return apimodels.GettableAlerts{}, nil
}

// TODO(santiago): implement.
func (am *externalAlertmanager) GetAlertGroups(active, silenced, inhibited bool, filter []string, receiver string) (apimodels.AlertGroups, error) {
	fmt.Println("externalAM.GetAlertGroups() called")
	return apimodels.AlertGroups{}, nil
}

// TODO(santiago): implement.
func (am *externalAlertmanager) PutAlerts(postableAlerts apimodels.PostableAlerts) error {
	fmt.Println("externalAM.PutAlerts() called")
	return am.client.SendAlertToAlermanager(context.TODO(), postableAlerts)
}

// TODO(santiago): implement.
func (am *externalAlertmanager) GetReceivers(ctx context.Context) []apimodels.Receiver {
	fmt.Println("externalAM.GetReceivers() called")
	return []apimodels.Receiver{}
}

// TODO(santiago): implement.
func (am *externalAlertmanager) TestReceivers(ctx context.Context, c apimodels.TestReceiversConfigBodyParams) (*TestReceiversResult, error) {
	fmt.Println("externalAM.TestReceivers() called")
	return &TestReceiversResult{}, nil
}

// TODO(santiago): implement.
func (am *externalAlertmanager) TestTemplate(ctx context.Context, c apimodels.TestTemplatesConfigBodyParams) (*TestTemplatesResults, error) {
	fmt.Println("externalAM.TestTemplate() called")
	return &alertingNotify.TestTemplatesResults{}, nil
}

// TODO(santiago): implement.
func (am *externalAlertmanager) ConfigHash() [16]byte {
	fmt.Println("externalAM.ConfigHash() called")
	return [16]byte{}
}

// TODO(santiago): implement.
func (am *externalAlertmanager) FileStore() *FileStore {
	fmt.Println("externalAM.FileStore() called")
	return &FileStore{}
}

// TODO(santiago): implement.
func (am *externalAlertmanager) OrgID() int64 {
	fmt.Println("externalAM.OrgID() called")
	return 1
}

// TODO(santiago): implement.
func (am *externalAlertmanager) Ready() bool {
	fmt.Println("externalAM.Ready() called")
	return false
}

// TODO(santiago): implement.
func (am *externalAlertmanager) StopAndWait() {
	fmt.Println("externalAM.StopAndWait() called")
	return
}
