package gcomsso

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	gcomApiTokenKey      = "api_token"
	gcomSsoConfigSection = "gcom_sso"
)

type GComLogoutRequest struct {
	Token     string `json:"idToken"`
	SessionID string `json:"sessionId"`
}

type config struct {
	grafanaComUrl string
	gcomApiToken  string
}

type GComSSOService struct {
	cfg               config
	log               *slog.Logger
	pluginSettingsSvc pluginsettings.Service
}

func ProvideGComSSOService(cfg *setting.Cfg) (*GComSSOService, error) {
	hookCfg, err := readConfig(cfg)
	if err != nil {
		return nil, err
	}

	return &GComSSOService{
		cfg: *hookCfg,
		log: slog.Default().With("logger", "gcomsso-service"),
	}, nil
}

func (s *GComSSOService) LogoutHook(ctx context.Context, user identity.Requester, sessionToken *usertoken.UserToken) error {
	data, err := json.Marshal(&GComLogoutRequest{
		Token:     user.GetIDToken(),
		SessionID: fmt.Sprint(sessionToken.Id),
	})
	if err != nil {
		s.log.Error("failed to marshal request", "error", err)
		return err
	}

	hReq, err := http.NewRequestWithContext(ctx, http.MethodPost, s.cfg.grafanaComUrl+"/api/logout/grafana/sso", bytes.NewReader(data))
	if err != nil {
		return err
	}
	hReq.Header.Add("Content-Type", "application/json")
	hReq.Header.Add("Authorization", "Bearer "+s.cfg.gcomApiToken)

	c := http.DefaultClient
	resp, err := c.Do(hReq)
	if err != nil {
		s.log.Error("failed to send request", "error", err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("failed to logout from grafana com: %d", resp.StatusCode)
	}

	return nil
}

func readConfig(cfg *setting.Cfg) (*config, error) {
	section, err := cfg.Raw.GetSection(gcomSsoConfigSection)
	if err != nil {
		return nil, err
	}

	return &config{
		grafanaComUrl: cfg.GrafanaComURL,
		gcomApiToken:  section.Key(gcomApiTokenKey).Value(),
	}, nil
}
