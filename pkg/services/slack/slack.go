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

func (s *SlackService) PostMessage(ctx context.Context, shareRequest dtos.ShareRequest, title string, resourceLink string) error {
	blocks := []Block{{
		Type: "header",
		Text: &Text{
			Type: "plain_text",
			Text: title,
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

	imageText := "Dashboard preview"
	if shareRequest.PanelId != "" {
		imageText = "Panel preview"
	}

	blocks = append(blocks, []Block{
		{
			Type: "image",
			Title: &Text{
				Type: "plain_text",
				Text: imageText,
			},
			ImageURL: shareRequest.ImagePreviewUrl,
			AltText:  imageText,
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
				URL:   resourceLink,
			}},
		}}...)

	for _, channelID := range shareRequest.ChannelIds {
		postMessageRequest := &PostMessageRequest{
			Channel: channelID,
			Blocks:  blocks,
		}

		jsonBody, err := json.Marshal(postMessageRequest)
		if err != nil {
			return fmt.Errorf("could not create request body: %w", err)
		}
		s.log.Info("Posting to slack api", "eventPayload", string(jsonBody))

		resp, err := s.postRequest(ctx, "chat.postMessage", bytes.NewReader(jsonBody))
		if err != nil {
			s.log.Info("Posting to slack api", "eventPayload", err)
			return err
		}

		s.log.Debug("successfully sent postMessage event payload", "channel", channelID, "response", string(resp))
	}

	return nil
}

func (s *SlackService) PostUnfurl(ctx context.Context, linkEvent EventPayload, imageURL string, dashboardTitle string) error {
	unfurlEvent := &UnfurlEventPayload{
		Channel: linkEvent.Event.Channel,
		TS:      linkEvent.Event.MessageTS,
		Unfurls: make(Unfurls),
	}

	for _, link := range linkEvent.Event.Links {
		unfurlEvent.Unfurls[link.URL] = Unfurl{
			Blocks: []Block{
				{
					Type: "header",
					Text: &Text{
						Type: "plain_text",
						Text: dashboardTitle,
					},
				},
				{
					Type: "section",
					Text: &Text{
						Type: "plain_text",
						Text: "Here is the dashboard that I wanted to show you",
					},
				},
				{
					Type: "image",
					Title: &Text{
						Type: "plain_text",
						Text: "Dashboard preview",
					},
					ImageURL: imageURL,
					AltText:  "dashboard preview",
				},
				{
					Type: "actions",
					Elements: []Element{{
						Type: "button",
						Text: &Text{
							Type: "plain_text",
							Text: "View Dashboard",
						},
						Style: "primary",
						Value: link.URL,
						URL:   link.URL,
					}},
				},
			},
		}
	}

	jsonBody, err := json.Marshal(unfurlEvent)
	if err != nil {
		return fmt.Errorf("could not create request body: %w", err)
	}
	s.log.Info("Posting to slack api", "eventPayload", string(jsonBody))

	resp, err := s.postRequest(ctx, "chat.unfurl", bytes.NewReader(jsonBody))
	if err != nil {
		return err
	}

	s.log.Debug("successfully sent unfurl event payload", "response", string(resp))
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
