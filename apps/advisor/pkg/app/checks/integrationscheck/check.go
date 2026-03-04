package integrationscheck

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
)

const (
	CheckID       = "integrations"
	EasystartType = "grafana-easystart-app"
	// LogQueryKey is the structured log field to query all logs from this check (e.g. advisor_integrations_check=integrations).
	LogQueryKey = "advisor_integrations_check"
)

const logQueryValue = "integrations"

// IntegrationItem represents a single integration for the check. Items() returns these; the update step uses them.
type IntegrationItem struct {
	Slug             string
	Name             string
	LatestVersion    string
	InstalledVersion string
}

func New(pluginSettings pluginsettings.Service) checks.Check {
	return &check{
		pluginSettings: pluginSettings,
		log:            logging.DefaultLogger.With(LogQueryKey, logQueryValue),
	}
}

type check struct {
	pluginSettings pluginsettings.Service
	log            logging.Logger
}

func (c *check) ID() string {
	return CheckID
}

func (c *check) Name() string {
	return "integrations"
}

func (c *check) Items(ctx context.Context) ([]any, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	orgID := requester.GetOrgID()
	items, err := c.fetchIntegrations(ctx, orgID)
	if err != nil {
		c.log.WithContext(ctx).Debug("Items: fetch failed, returning empty list", "orgID", orgID, "error", err)
		return []any{}, nil
	}
	res := make([]any, len(items))
	for i := range items {
		res[i] = &items[i]
	}
	return res, nil
}

func (c *check) Item(ctx context.Context, id string) (any, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	items, err := c.fetchIntegrations(ctx, requester.GetOrgID())
	if err != nil {
		return nil, nil
	}
	for i := range items {
		if items[i].Slug == id {
			return &items[i], nil
		}
	}
	return nil, nil
}

func (c *check) Init(ctx context.Context) error {
	return nil
}

func (c *check) Steps() []checks.Step {
	return []checks.Step{
		&updateStep{},
	}
}

// fetchIntegrations loads easystart app settings, calls the integrations API, and returns integration items.
func (c *check) fetchIntegrations(ctx context.Context, orgID int64) ([]IntegrationItem, error) {
	log := c.log.WithContext(ctx)

	ps, err := c.pluginSettings.GetPluginSettingByPluginID(ctx, &pluginsettings.GetByPluginIDArgs{
		PluginID: EasystartType,
		OrgID:    orgID,
	})
	if err != nil {
		if errors.Is(err, pluginsettings.ErrPluginSettingNotFound) {
			log.Debug("fetchIntegrations: easystart plugin not configured", "orgID", orgID)
			return nil, err
		}
		return nil, fmt.Errorf("get plugin setting: %w", err)
	}

	integrationsEndpoint, stackID, authToken, err := getAPIConfigFromSetting(ps, c.pluginSettings)
	if err != nil {
		log.Debug("fetchIntegrations: invalid config", "error", err)
		return nil, err
	}

	url := fmt.Sprintf("%s/v2/stacks/%s/integrations?installed=true", integrationsEndpoint, stackID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+authToken)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Debug("fetchIntegrations: API request failed", "url", url, "error", err)
		return nil, fmt.Errorf("integrations API request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		log.Debug("fetchIntegrations: unexpected API status", "url", url, "status", resp.StatusCode)
		return nil, fmt.Errorf("integrations API returned status %d", resp.StatusCode)
	}

	var body integrationsAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("decode integrations response: %w", err)
	}

	items := make([]IntegrationItem, 0, len(body.Data))
	for _, entry := range body.Data {
		if entry.Install == nil {
			continue
		}
		installedVer := entry.Install.Version
		latestVer := entry.Version
		if installedVer == "" || latestVer == "" {
			continue
		}
		items = append(items, IntegrationItem{
			Slug:             entry.Slug,
			Name:             entry.Name,
			LatestVersion:    latestVer,
			InstalledVersion: installedVer,
		})
	}
	log.Debug("fetchIntegrations: done", "stackID", stackID, "total", len(body.Data), "installed", len(items))
	return items, nil
}

func getAPIConfigFromSetting(ps *pluginsettings.DTO, decrypter interface {
	DecryptedValues(ps *pluginsettings.DTO) map[string]string
}) (integrationsEndpoint, stackID, authToken string, err error) {
	if ps.JSONData == nil {
		return "", "", "", fmt.Errorf("plugin setting has no jsonData")
	}
	integrationsEndpoint, _ = ps.JSONData["integrations_endpoint"].(string)
	if integrationsEndpoint == "" {
		return "", "", "", fmt.Errorf("integrations_endpoint not set")
	}
	instanceID := intFromAny(ps.JSONData["grafana_instance_id"])
	if instanceID == 0 {
		return "", "", "", fmt.Errorf("grafana_instance_id not set")
	}
	stackID = strconv.Itoa(instanceID)

	secure := decrypter.DecryptedValues(ps)
	authToken = secure["auth_header_content"]
	if authToken == "" {
		return "", "", "", fmt.Errorf("auth_header_content not set")
	}
	const bearer = "Bearer "
	if len(authToken) > len(bearer) && authToken[:len(bearer)] == bearer {
		authToken = authToken[len(bearer):]
	}
	return integrationsEndpoint, stackID, authToken, nil
}

func intFromAny(v any) int {
	if v == nil {
		return 0
	}
	switch n := v.(type) {
	case int:
		return n
	case int64:
		return int(n)
	case float64:
		return int(n)
	}
	return 0
}

// integrationsAPIResponse matches the response from /v2/stacks/{stack_id}/integrations?installed=true
type integrationsAPIResponse struct {
	Data map[string]integrationEntry `json:"data"`
}

type integrationEntry struct {
	Name    string        `json:"name"`
	Slug    string        `json:"slug"`
	Version string        `json:"version"`
	Install *installation `json:"installation"`
}

type installation struct {
	Version     string `json:"version"`
	InstalledOn string `json:"installed_on"`
}
