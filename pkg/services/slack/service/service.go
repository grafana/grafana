package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"github.com/grafana/grafana/pkg/models"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboardimage"
	"github.com/grafana/grafana/pkg/services/slack/model"
	"github.com/grafana/grafana/pkg/util/errutil"
	"io"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

type SlackService struct {
	cfg                   *setting.Cfg
	log                   log.Logger
	dashboardImageService dashboardimage.Service
}

func ProvideService(cfg *setting.Cfg, ds dashboardimage.Service) (*SlackService, error) {
	return &SlackService{
		cfg:                   cfg,
		log:                   log.New("slack"),
		dashboardImageService: ds,
	}, nil
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

func (s *SlackService) PostMessage(ctx context.Context, shareRequest dtos.ShareRequest, resourceLink string) error {
	imageText := "Preview"

	blocks := []model.Block{{
		Type: "header",
		Text: &model.Text{
			Type: "plain_text",
			Text: shareRequest.Title,
		},
	}}

	if shareRequest.Message != "" {
		blocks = append(blocks, model.Block{
			Type: "section",
			Text: &model.Text{
				Type: "plain_text",
				Text: shareRequest.Message,
			},
		})
	}

	blocks = append(blocks, []model.Block{
		{
			Type: "image",
			Title: &model.Text{
				Type: "plain_text",
				Text: imageText,
			},
			ImageURL: shareRequest.ImagePreviewUrl,
			AltText:  imageText,
		},
		{
			Type: "actions",
			Elements: []model.Element{{
				Type: "button",
				Text: &model.Text{
					Type: "plain_text",
					Text: "View in Grafana",
				},
				Style: "primary",
				Value: "View in Grafana",
				URL:   resourceLink,
			}},
		}}...)

	// async? should we support multiple channels?
	for _, channelID := range shareRequest.ChannelIds {
		postMessageRequest := &model.PostMessageRequest{
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
			s.log.Error("Failed to post on slack api", "eventPayload", err)
			return err
		}

		s.log.Debug("successfully sent postMessage event payload", "channel", channelID, "response", string(resp))
	}

	return nil
}

func (s *SlackService) PostUnfurl(ctx context.Context, linkEvent model.EventPayload, imageURL string, dashboardTitle string) error {
	unfurlEvent := &model.UnfurlEventPayload{
		Channel: linkEvent.Event.Channel,
		TS:      linkEvent.Event.MessageTS,
		Unfurls: make(model.Unfurls),
	}

	for _, link := range linkEvent.Event.Links {
		unfurlEvent.Unfurls[link.URL] = model.Unfurl{
			Blocks: []model.Block{
				{
					Type: "header",
					Text: &model.Text{
						Type: "plain_text",
						Text: dashboardTitle,
					},
				},
				{
					Type: "section",
					Text: &model.Text{
						Type: "plain_text",
						Text: "Here is the dashboard that I wanted to show you",
					},
				},
				{
					Type: "image",
					Title: &model.Text{
						Type: "plain_text",
						Text: "Dashboard preview",
					},
					ImageURL: imageURL,
					AltText:  "dashboard preview",
				},
				{
					Type: "actions",
					Elements: []model.Element{{
						Type: "button",
						Text: &model.Text{
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

func (s *SlackService) ValidateSignatureRequest(c *contextmodel.ReqContext, body string) bool {
	signature := c.Req.Header.Get("X-Slack-Signature")
	timestamp := c.Req.Header.Get("X-Slack-Request-Timestamp")

	mySignature := fmt.Sprintf("v0:%v:%v", timestamp, body)
	requestSignatureHash := fmt.Sprintf("v0=%s", calculateHMAC([]byte(mySignature), []byte(s.cfg.SlackSigningSecret)))
	if !hmac.Equal([]byte(signature), []byte(requestSignatureHash)) {
		return false
	}

	return true
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

	var response model.PostMessageResponse
	err = json.Unmarshal(b, &response)
	if err != nil {
		s.log.Error("error parsing json", "err", err)
		return nil, err
	}
	if !response.Ok {
		return b, &errutil.Error{LogMessage: string(b)}
	}

	return b, nil
}

func (s *SlackService) TakeScreenshot(ctx context.Context, opts dashboardimage.ScreenshotOptions) (string, error) {
	opts = dashboardimage.ScreenshotOptions{
		AuthOptions:  opts.AuthOptions,
		OrgID:        opts.OrgID,
		DashboardUID: opts.DashboardUID,
		PanelID:      opts.PanelID,
		From:         opts.From,
		To:           opts.To,
		Width:        1600,
		Height:       800,
		Theme:        models.ThemeDark,
		Timeout:      time.Duration(60) * time.Second,
	}
	path, err := s.dashboardImageService.TakeScreenshotAndUpload(ctx, opts)
	if err != nil {
		return "", err
	}

	return path, nil
}

func calculateHMAC(message, key []byte) string {
	hash := hmac.New(sha256.New, key)
	hash.Write(message)
	return hex.EncodeToString(hash.Sum(nil))
}
