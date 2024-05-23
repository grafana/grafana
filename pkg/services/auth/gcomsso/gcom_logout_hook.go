package gcomsso

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
)

const (
	tokenKey          = "cloudAdminApiToken"
	grafanaComUrlKey  = "grafanaComUrl"
	cloudHomePluginId = "cloud-home-app"
)

type GComLogoutRequest struct {
	Token     string `json:"idToken"`
	SessionID string `json:"sessionId"`
}

type GComSSOService struct {
	log               *slog.Logger
	pluginSettingsSvc pluginsettings.Service
}

func ProvideGComSSOService(pluginSettingsSvc pluginsettings.Service) *GComSSOService {
	return &GComSSOService{
		log:               slog.Default().With("logger", "gcomsso-service"),
		pluginSettingsSvc: pluginSettingsSvc,
	}
}

func (s *GComSSOService) LogoutHook(ctx context.Context, user identity.Requester, sessionToken *usertoken.UserToken) error {
	pluginSetting, err := s.pluginSettingsSvc.GetPluginSettingByPluginID(ctx, &pluginsettings.GetByPluginIDArgs{OrgID: 1, PluginID: cloudHomePluginId})
	if err != nil {
		s.log.Error("failed to get plugin setting", "error", err)
		return err
	}

	grafanaComUrl, gcomCloudAdminToken, err := getConfiguration(pluginSetting, s.pluginSettingsSvc)
	if err != nil {
		s.log.Error("failed to get configuration", "error", err)
		return err
	}

	data, err := json.Marshal(&GComLogoutRequest{
		Token:     user.GetIDToken(),
		SessionID: fmt.Sprint(sessionToken.Id),
	})
	if err != nil {
		s.log.Error("failed to marshal request", "error", err)
		return err
	}

	hReq, err := http.NewRequestWithContext(ctx, http.MethodPost, grafanaComUrl+"/api/logout/grafana/sso", bytes.NewReader(data))
	if err != nil {
		return err
	}
	hReq.Header.Add("Content-Type", "application/json")
	hReq.Header.Add("Authorization", "Bearer "+gcomCloudAdminToken)

	c := http.DefaultClient
	resp, err := c.Do(hReq)
	if err != nil {
		s.log.Error("failed to send request", "error", err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		s.log.Error("failed to logout from grafana com", "status", resp.StatusCode)
		return fmt.Errorf("failed to logout from grafana com: %d", resp.StatusCode)
	}

	return nil
}

func getConfiguration(pluginSetting *pluginsettings.DTO, pluginSettingsSvc pluginsettings.Service) (string, string, error) {
	if _, exists := pluginSetting.JSONData[grafanaComUrlKey]; !exists {
		return "", "", fmt.Errorf("%s was not configured for plugin", grafanaComUrlKey)
	}
	grafanaComUrl := strings.TrimRight(pluginSetting.JSONData[grafanaComUrlKey].(string), "/api")

	decryptedSecureJSONData := pluginSettingsSvc.DecryptedValues(pluginSetting)
	if decryptedSecureJSONData == nil {
		return "", "", fmt.Errorf("failed to decrypt secureJSONData for plugin %s", cloudHomePluginId)
	}
	gcomCloudAdminToken, exists := decryptedSecureJSONData[tokenKey]
	if !exists {
		return "", "", fmt.Errorf("%s was not configured for plugin", tokenKey)
	}
	return grafanaComUrl, gcomCloudAdminToken, nil
}
