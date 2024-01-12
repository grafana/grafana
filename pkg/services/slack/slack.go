package slack

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
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

func (s *SlackService) PostMessage(ctx context.Context, shareRequest dtos.ShareRequest, dashboardTitle string) error {
	grafanaURL := s.getGrafanaURL()
	dashboardLink := fmt.Sprintf("%s%s", grafanaURL, shareRequest.DashboardPath)

	blocks := []Block{{
		Type: "section",
		Text: &Text{
			Type: "mrkdwn",
			Text: fmt.Sprintf("<%s|*%s*>", dashboardLink, dashboardTitle),
		},
	}}

	if shareRequest.Message != "" {
		blocks = append(blocks, Block{
			Type: "section",
			Text: &Text{
				Type: "plain_text",
				Text: shareRequest.Message,
			},
		})
	}

	blocks = append(blocks, []Block{
		{
			Type: "image",
			Title: &Text{
				Type: "plain_text",
				Text: "Dashboard preview",
			},
			ImageURL: shareRequest.ImagePreviewUrl,
			AltText:  "dashboard preview",
		},
		{
			Type: "actions",
			Elements: []Element{{
				Type: "button",
				Text: &Text{
					Type: "plain_text",
					Text: "View in Grafana",
				},
				Style: "primary",
				Value: "View in Grafana",
				URL:   dashboardLink,
			}},
		}}...)

	for _, channelID := range shareRequest.ChannelIds {
		postMessageRequest := &PostMessageRequest{
			Channel: channelID,
			Blocks:  blocks,
		}

		jsonBody, err := json.Marshal(postMessageRequest)
		if err != nil {
			return err
		}
		s.log.Info("Posting to slack api", "eventPayload", string(jsonBody))

		resp, err := s.postRequest(ctx, "chat.postMessage", bytes.NewReader(jsonBody))
		if err != nil {
			return err
		}
		s.log.Info("successfully sent postMessage event payload", "channel", channelID, "body", string(resp))
	}

	return nil
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
