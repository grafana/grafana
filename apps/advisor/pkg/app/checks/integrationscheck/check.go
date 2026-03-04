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
)

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
		log:            logging.DefaultLogger.With("check", CheckID),
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
	log := c.log.WithContext(ctx)
	log.Debug("Items: starting")
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		log.Debug("Items: failed to get requester", "error", err)
		return nil, err
	}
	orgID := requester.GetOrgID()
	log.Debug("Items: fetching integrations", "orgID", orgID)
	items, err := c.fetchIntegrations(ctx, orgID)
	if err != nil {
		// No app settings or API error: return empty list so the check runs with 0 items
		log.Debug("Items: fetch failed, returning empty list", "error", err)
		return []any{}, nil
	}
	log.Debug("Items: fetched integrations", "count", len(items))
	res := make([]any, len(items))
	for i := range items {
		res[i] = &items[i]
	}
	return res, nil
}

func (c *check) Item(ctx context.Context, id string) (any, error) {
	log := c.log.WithContext(ctx)
	log.Debug("Item: starting", "id", id)
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		log.Debug("Item: failed to get requester", "error", err)
		return nil, err
	}
	items, err := c.fetchIntegrations(ctx, requester.GetOrgID())
	if err != nil {
		log.Debug("Item: fetch failed", "id", id, "error", err)
		return nil, nil
	}
	for i := range items {
		if items[i].Slug == id {
			log.Debug("Item: found integration", "id", id, "name", items[i].Name)
			return &items[i], nil
		}
	}
	log.Debug("Item: integration not found", "id", id)
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
	log.Debug("fetchIntegrations: starting", "orgID", orgID)

	ps, err := c.pluginSettings.GetPluginSettingByPluginID(ctx, &pluginsettings.GetByPluginIDArgs{
		PluginID: EasystartType,
		OrgID:    orgID,
	})
	if err != nil {
		if errors.Is(err, pluginsettings.ErrPluginSettingNotFound) {
			log.Debug("fetchIntegrations: plugin setting not found", "pluginID", EasystartType)
			return nil, err
		}
		log.Debug("fetchIntegrations: get plugin setting failed", "error", err)
		return nil, fmt.Errorf("get plugin setting: %w", err)
	}
	log.Debug("fetchIntegrations: got plugin setting")

	integrationsEndpoint, stackID, authToken, err := getAPIConfigFromSetting(ps, c.pluginSettings)
	if err != nil {
		log.Debug("fetchIntegrations: getAPIConfigFromSetting failed", "error", err)
		return nil, err
	}
	log.Debug("fetchIntegrations: config ok", "endpoint", integrationsEndpoint, "stackID", stackID, "hasToken", authToken != "")

	url := fmt.Sprintf("%s/v2/stacks/%s/integrations?installed=true", integrationsEndpoint, stackID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+authToken)

	log.Debug("fetchIntegrations: calling integrations API", "url", url)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Debug("fetchIntegrations: API request failed", "error", err)
		return nil, fmt.Errorf("integrations API request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	log.Debug("fetchIntegrations: API response", "status", resp.StatusCode)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("integrations API returned status %d", resp.StatusCode)
	}

	var body integrationsAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		log.Debug("fetchIntegrations: decode failed", "error", err)
		return nil, fmt.Errorf("decode integrations response: %w", err)
	}
	log.Debug("fetchIntegrations: decoded response", "dataEntries", len(body.Data))

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
	log.Debug("fetchIntegrations: done", "itemsCount", len(items))
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
