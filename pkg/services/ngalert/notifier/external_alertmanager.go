package notifier

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"gopkg.in/yaml.v3"
)

type externalAlertmanager struct {
	url      string
	username string
	password string
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

type alwkdnaw interface {
}

func NewExternalMultiOrgAlertmanager(url, username, password string, store configStore, log log.Logger) *externalMultiOrgAlertmanager {
	am := externalAlertmanager{
		url:      url,
		username: username,
		password: password,
	}

	return &externalMultiOrgAlertmanager{
		log:          log,
		store:        store,
		alertmanager: &am,
	}
}

// TODO: we're completely ignoring orgID.
func (am *externalMultiOrgAlertmanager) AlertmanagerFor(orgID int64) (Alertmanager, error) {
	// TODO: main OrgID always 1?
	fmt.Println("noop.AlertmanagerFor() called")
	if orgID == 1 {
		// TODO: I don't really need this layer of abstraction if we're nut being multi-org.
		return am.alertmanager, nil
	}
	return nil, ErrNoAlertmanagerForOrg
}

// Note: we could use this to sync internal and external AM config.
func (am *externalMultiOrgAlertmanager) LoadAndSyncAlertmanagersForOrgs(ctx context.Context) error {
	fmt.Println("noop.LoadAndSyncAlertmanagersForOrgs() called")
	// TODO: pull, merge, post AM configs.
	// TODO: move, no-op moa would be a better place for this.
	// Get configuration from the external Alertmanager.
	externalConfig, err := getExternalAmConfig(ctx, am.alertmanager.url, am.alertmanager.username, am.alertmanager.password)
	if err != nil {
		return err
	}

	// TODO: main org.
	query := models.GetLatestAlertmanagerConfigurationQuery{
		OrgID: 1,
	}
	internalConfig, err := am.store.GetLatestAlertmanagerConfiguration(ctx, &query)
	if err != nil {
		return err
	}

	// Merge configurations.
	mergedConfiguration, err := mergeAlertmanagerConfigurations(internalConfig, externalConfig)
	if err != nil {
		return err
	}

	// TODO: check if we need to update or if we already did.
	// Update external AM configuration.
	if err := postExternalAmConfig(ctx, am.alertmanager.url, am.alertmanager.username, am.alertmanager.password, mergedConfiguration); err != nil {
		return err
	}

	// Disable internal Alertmanager.
	return nil
}

func (*externalMultiOrgAlertmanager) Run(ctx context.Context) error {
	fmt.Println("noop.Run() called")
	return nil
}

func (*externalMultiOrgAlertmanager) ActivateHistoricalConfiguration(ctx context.Context, orgId int64, id int64) error {
	fmt.Println("noop.ActivateHistoricalConfiguration() called")
	return nil
}

func (am *externalMultiOrgAlertmanager) GetAlertmanagerConfiguration(ctx context.Context, org int64) (apimodels.GettableUserConfig, error) {
	fmt.Println("noop.GetAlertmanagerConfiguration() called")
	config, err := getExternalAmConfig(ctx, am.alertmanager.url, am.alertmanager.username, am.alertmanager.password)
	if err != nil {
		return apimodels.GettableUserConfig{}, err
	}
	fmt.Println("Config:", config)
	return config, nil
}

func (*externalMultiOrgAlertmanager) GetAppliedAlertmanagerConfigurations(ctx context.Context, org int64, limit int) ([]*apimodels.GettableHistoricUserConfig, error) {
	fmt.Println("noop.GetAppliedAlertmanagerConfigurations() called")
	return []*apimodels.GettableHistoricUserConfig{}, nil
}

func (am *externalMultiOrgAlertmanager) ApplyAlertmanagerConfiguration(ctx context.Context, org int64, config apimodels.PostableUserConfig) error {
	fmt.Println("noop.ApplyAlertmanagerConfiguration() called")
	return postExternalAmConfig(ctx, am.alertmanager.url, am.alertmanager.username, am.alertmanager.password, &config)
}

// YOLO
func (am *externalAlertmanager) SaveAndApplyConfig(ctx context.Context, config *apimodels.PostableUserConfig) error {
	fmt.Println("externalAM.SaveAndApplyConfig() called")
	return nil
}
func (am *externalAlertmanager) SaveAndApplyDefaultConfig(ctx context.Context) error {
	fmt.Println("externalAM.SaveAndApplyDefaultConfig() called")
	return nil
}
func (am *externalAlertmanager) GetStatus() apimodels.GettableStatus {
	fmt.Println("externalAM.GetStatus() called")
	return apimodels.GettableStatus{}
}

func (am *externalAlertmanager) CreateSilence(ps *apimodels.PostableSilence) (string, error) {
	fmt.Println("externalAM.CreateSilence() called")
	return "", nil
}
func (am *externalAlertmanager) DeleteSilence(silenceID string) error {
	fmt.Println("externalAM.DeleteSilence() called")
	return nil
}
func (am *externalAlertmanager) GetSilence(silenceID string) (apimodels.GettableSilence, error) {
	fmt.Println("externalAM.GetSilence() called")
	return apimodels.GettableSilence{}, nil
}

// TODO: filters.
func (am *externalAlertmanager) ListSilences(filter []string) (apimodels.GettableSilences, error) {
	fmt.Println("externalAM.ListSilences() called")
	return getExternalAmSilences(context.TODO(), am.url, am.username, am.password)
}
func (am *externalAlertmanager) GetAlerts(active, silenced, inhibited bool, filter []string, receiver string) (apimodels.GettableAlerts, error) {
	fmt.Println("externalAM.GetAlerts() called")
	return apimodels.GettableAlerts{}, nil
}
func (am *externalAlertmanager) GetAlertGroups(active, silenced, inhibited bool, filter []string, receiver string) (apimodels.AlertGroups, error) {
	fmt.Println("externalAM.GetAlertGroups() called")
	return apimodels.AlertGroups{}, nil
}
func (am *externalAlertmanager) PutAlerts(postableAlerts apimodels.PostableAlerts) error {
	fmt.Println("externalAM.PutAlerts() called")
	return nil
}
func (am *externalAlertmanager) GetReceivers(ctx context.Context) []apimodels.Receiver {
	fmt.Println("externalAM.GetReceivers() called")
	return []apimodels.Receiver{}
}
func (am *externalAlertmanager) TestReceivers(ctx context.Context, c apimodels.TestReceiversConfigBodyParams) (*TestReceiversResult, error) {
	fmt.Println("externalAM.TestReceivers() called")
	return &TestReceiversResult{}, nil
}
func (am *externalAlertmanager) TestTemplate(ctx context.Context, c apimodels.TestTemplatesConfigBodyParams) (*TestTemplatesResults, error) {
	fmt.Println("externalAM.TestTemplate() called")
	return &alertingNotify.TestTemplatesResults{}, nil
}

// TODO: implement, but are we merging?
func getExternalAmConfig(ctx context.Context, url string, user string, password string) (apimodels.GettableUserConfig, error) {
	req, err := http.NewRequest("GET", url+"/api/v1/alerts", nil)
	if err != nil {
		return apimodels.GettableUserConfig{}, err
	}
	// TODO: use basic auth...
	fmt.Println("Making GET request to", req.URL)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return apimodels.GettableUserConfig{}, err
	}
	defer res.Body.Close()

	if res.StatusCode/100 != 2 {
		return apimodels.GettableUserConfig{}, fmt.Errorf("bad response status %s", res.Status)
	}

	var gettableUserConfig apimodels.GettableUserConfig
	if err := yaml.NewDecoder(res.Body).Decode(&gettableUserConfig); err != nil {
		// return apimodels.GettableUserConfig{}, err
		fmt.Println("Error!:", err)
		return apimodels.GettableUserConfig{}, nil
	}

	return gettableUserConfig, nil
}

// TODO: implement merge, for now it's ignoring the external configuration and parsing the internal one into a postable config.
// mergeAlertmanagerConfigurations takes the Grafana Alertmanager configuration and the external Alertmanager configuration.
// It merges both into a single configuration that can be applied to the external Alertmanager.
func mergeAlertmanagerConfigurations(internalConfig *models.AlertConfiguration, externalConfig apimodels.GettableUserConfig) (*apimodels.PostableUserConfig, error) {
	postableConfig, err := Load([]byte(internalConfig.AlertmanagerConfiguration))
	if err != nil {
		return nil, err
	}
	return postableConfig, nil
}

// Note: this can be moved to the no-op Multiorg Alertmanager.
func postExternalAmConfig(ctx context.Context, url, user, password string, config *apimodels.PostableUserConfig) error {
	b, err := yaml.Marshal(config)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url+"/api/v1/alerts", bytes.NewReader(b))
	if err != nil {
		return err
	}

	// TODO: use basic auth...
	fmt.Println("Making POST request to", req.URL, "with data", string(b))
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	io.Copy(io.Discard, res.Body)

	if res.StatusCode/100 != 2 {
		return fmt.Errorf("bad response status %s", res.Status)
	}

	return nil
}

func getExternalAmSilences(ctx context.Context, url, user, password string) (apimodels.GettableSilences, error) {
	req, err := http.NewRequest("GET", url+"/alertmanager/api/v2/silences", nil)
	if err != nil {
		return apimodels.GettableSilences{}, err
	}
	// TODO: use basic auth...
	fmt.Println("Making GET request to", req.URL)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return apimodels.GettableSilences{}, err
	}
	defer res.Body.Close()

	if res.StatusCode/100 != 2 {
		return apimodels.GettableSilences{}, fmt.Errorf("bad response status %s", res.Status)
	}

	var silences apimodels.GettableSilences
	if err := json.NewDecoder(res.Body).Decode(&silences); err != nil {
		// return apimodels.GettableUserConfig{}, err
		fmt.Println("Error!:", err)
		return apimodels.GettableSilences{}, nil
	}

	return silences, nil
}
