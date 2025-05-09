package gcomsso

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/httpclient"
)

type gcomLogoutRequest struct {
	Token     string `json:"idToken"`
	SessionID string `json:"sessionId"`
}

type GComSSOService struct {
	cfg    *setting.Cfg
	logger *slog.Logger
}

func ProvideGComSSOService(cfg *setting.Cfg) *GComSSOService {
	return &GComSSOService{
		cfg:    cfg,
		logger: slog.Default().With("logger", "gcomsso-service"),
	}
}

func (s *GComSSOService) LogoutHook(ctx context.Context, user identity.Requester, sessionToken *usertoken.UserToken) error {
	s.logger.Debug("Logging out from Grafana.com", "user", user.GetID(), "session", sessionToken.Id)
	data, err := json.Marshal(&gcomLogoutRequest{
		Token:     user.GetIDToken(),
		SessionID: fmt.Sprint(sessionToken.Id),
	})
	if err != nil {
		s.logger.Error("failed to marshal request", "error", err)
		return err
	}

	hReq, err := http.NewRequestWithContext(ctx, http.MethodPost, s.cfg.GrafanaComURL+"/api/logout/grafana/sso", bytes.NewReader(data))
	if err != nil {
		return err
	}
	hReq.Header.Add("Content-Type", "application/json")
	hReq.Header.Add("Authorization", "Bearer "+s.cfg.GrafanaComSSOAPIToken)

	c := httpclient.New()
	resp, err := c.Do(hReq)
	if err != nil {
		s.logger.Error("failed to send request", "error", err)
		return err
	}
	// nolint: errcheck
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("failed to logout from grafana com: %d", resp.StatusCode)
	}

	return nil
}
