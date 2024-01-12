package slack

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"io"
	"net/http"
)

type SlackService struct {
	cfg *setting.Cfg
	log log.Logger
}

func ProvideService(cfg *setting.Cfg) (*SlackService, error) {
	logger := log.New("slack")
	s := &SlackService{
		cfg: cfg,
		log: logger,
	}

	return s, nil
}

func (s *SlackService) GetUserConversations(ctx context.Context) (*dtos.SlackChannels, error) {
	bytes, err := s.postRequest(ctx, "users.conversations", nil)
	if err != nil {
		return nil, err
	}

	var result *dtos.SlackChannels
	err = json.Unmarshal(bytes, &result)
	if err != nil {
		return nil, err
	}

	return result, nil
}

func (s *SlackService) postRequest(ctx context.Context, endpoint string, body io.Reader) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("https://slack.com/api/%s", endpoint), body)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.cfg.SlackToken))
	req.Header.Set("Content-Type", "application/json; charset=utf-8")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			s.log.Error("failed to close response body", "err", err)
		}
	}()

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	return b, nil
}
