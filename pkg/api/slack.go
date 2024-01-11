package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	dtos "github.com/grafana/grafana/pkg/api/dtos"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/models/roletype"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) GetSlackChannels(c *contextmodel.ReqContext) response.Response {
	req, err := http.NewRequest(http.MethodPost, "https://slack.com/api/conversations.list", nil)
	req.Header.Add("Content-Type", "application/json; charset=utf-8")
	req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", hs.Cfg.SlackToken))

	if err != nil {
		fmt.Errorf("client: could not create request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Errorf("client: error making http request: %w", err)
	}
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Errorf("client: could not read response body: %w", err)
	}

	var result dtos.SlackChannels
	err = json.Unmarshal(b, &result)
	if err != nil {
		fmt.Errorf("client: could not unmarshall response: %w", err)
	}

	return response.JSON(http.StatusOK, result.Channels)
}

func (hs *HTTPServer) AcknowledgeSlackEvent(c *contextmodel.ReqContext) response.Response {
	var eventPayload EventPayload
	if err := web.Bind(c.Req, &eventPayload); err != nil {
		return response.Error(400, "error parsing body", err)
	}

	switch eventPayload.Type {
	case "url_verification":
		return response.JSON(http.StatusOK, &EventChallengeAck{
			Challenge: eventPayload.Challenge,
		})
	case "event_callback":
		if eventPayload.Event.Type != "link_shared" {
			break
		}

		defer hs.handleLinkSharedEvent(eventPayload)
		return response.Empty(http.StatusOK)
	}

	return response.Error(400, "not handling this event type", fmt.Errorf("not handling this event type"))
}

func (hs *HTTPServer) handleLinkSharedEvent(event EventPayload) {
	ctx := context.Background()
	// TODO: handle multiple links
	imagePath, err := hs.renderDashboard(ctx, event.Event.Links[0].URL)
	if err != nil {
		hs.log.Error("fail to render dashboard for Slack preview", "err", err)
		return
	}

	err = hs.sendUnfurlEvent(ctx, event, imagePath)
	if err != nil {
		hs.log.Error("fail to send unfurl event to Slack", "err", err)
	}
}

func (hs *HTTPServer) sendUnfurlEvent(c context.Context, linkEvent EventPayload, imagePath string) error {
	eventPayload := &UnfurlEventPayload{
		Channel: linkEvent.Event.Channel,
		TS:      linkEvent.Event.MessageTS,
		Unfurls: make(Unfurls),
	}

	imageFileName := filepath.Base(imagePath)
	imageURL := hs.getImageURL(imageFileName)
	for _, link := range linkEvent.Event.Links {
		eventPayload.Unfurls[link.URL] = Unfurl{
			Blocks: []Block{
				{
					Type: "header",
					Text: &Text{
						Type: "plain_text",
						// TODO: need to fetch the dashboard to get the title
						Text: "Dashboard title",
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
						Style:    "primary",
						Value:    link.URL,
						ActionID: "view",
					}},
				},
			},
		}
	}

	b, err := json.Marshal(eventPayload)
	if err != nil {
		return fmt.Errorf("client: could not create body: %w", err)
	}
	hs.log.Info("Posting to slack api", "eventPayload", string(b))

	bodyReader := bytes.NewReader(b)
	req, err := http.NewRequest(http.MethodPost, "https://slack.com/api/chat.unfurl", bodyReader)
	req.Header.Add("Content-Type", "application/json")
	req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", hs.Cfg.SlackToken))
	if err != nil {
		return fmt.Errorf("client: could not create request: %w", err)
	}

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("client: error making http request: %w", err)
	}

	resBody, err := io.ReadAll(res.Body)
	if err != nil {
		return fmt.Errorf("client: could not read response body: %w", err)
	}

	hs.log.Info("successfully sent unfurl event payload", "body", string(resBody))
	return nil
}

// TODO: Duplicated from the rendering service - maybe we can do this in another way to not duplicate this
func (hs *HTTPServer) getImageURL(imageName string) string {
	if hs.Cfg.RendererCallbackUrl != "" {
		return fmt.Sprintf("%s%s/%s", hs.Cfg.RendererCallbackUrl, "public/img/attachments", imageName)
	}

	protocol := hs.Cfg.Protocol
	switch protocol {
	case setting.HTTPScheme:
		protocol = "http"
	case setting.HTTP2Scheme, setting.HTTPSScheme:
		protocol = "https"
	default:
		// TODO: Handle other schemes?
	}

	subPath := ""
	if hs.Cfg.ServeFromSubPath {
		subPath = hs.Cfg.AppSubURL
	}

	domain := "localhost"
	if hs.Cfg.HTTPAddr != "0.0.0.0" {
		domain = hs.Cfg.HTTPAddr
	}

	return fmt.Sprintf("%s://%s:%s%s/%s/%s", protocol, domain, hs.Cfg.HTTPPort, subPath, "public/img/attachments", imageName)
}

func (hs *HTTPServer) RenderAndPostToSlack(c *contextmodel.ReqContext) response.Response {
	// TODO: hardcoded for now, the input of this method should be the event payload
	//source := "conversations_history"
	//unfurlID := "12345"
	rawURL := "http://localhost:3000/render/d/RvNCUVm4z/dashboard-with-expressions?orgId=1&from=1704891104021&to=1704912704021&width=1000&height=500&tz=America%2FBuenos_Aires"

	imagePath, err := hs.renderDashboard(c.Req.Context(), rawURL)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Rendering failed", err)
	}

	// post to slack api
	err = hs.sendUnfurlEvent(c.Req.Context(), EventPayload{}, imagePath)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Fail to send unfurl event to Slack", err)
	}

	return response.Empty(http.StatusOK)
}

func (hs *HTTPServer) renderDashboard(ctx context.Context, dashboardURL string) (string, error) {
	var renderPath string
	// Find the index of "/d/"
	index := strings.Index(dashboardURL, "/d/")

	// Check if "/d/" was found
	if index != -1 {
		// Extract the substring including "/d/"
		renderPath = dashboardURL[index+1:]
		fmt.Println(renderPath)
	} else {
		return "", fmt.Errorf("Invalid dashboard url")
	}

	result, err := hs.RenderService.Render(ctx, rendering.Opts{
		TimeoutOpts: rendering.TimeoutOpts{
			Timeout: time.Duration(60) * time.Second,
		},
		AuthOpts: rendering.AuthOpts{
			// TODO: get the org id from the URL
			OrgID:   1,
			OrgRole: roletype.RoleAdmin,
		},
		Width:  1600,
		Height: 800,
		//Path:   web.Params(c.Req)["*"] + queryParams,
		Path: renderPath,
		//Timezone:          queryReader.Get("tz", ""),
		//Encoding:          queryReader.Get("encoding", ""),
		ConcurrentLimit:   hs.Cfg.RendererConcurrentRequestLimit,
		DeviceScaleFactor: 1, // negative numbers will render larger and then scale down
		Theme:             models.ThemeDark,
	}, nil)
	if err != nil {
		return "", err
	}

	return result.FilePath, nil
}

type EventChallengeAck struct {
	Challenge string `json:"challenge"`
}

type EventPayload struct {
	Token              string          `json:"token"`
	TeamID             string          `json:"team_id"`
	APIAppID           string          `json:"api_app_id"`
	Event              Event           `json:"event"`
	Type               string          `json:"type"`
	EventID            string          `json:"event_id"`
	EventTime          int64           `json:"event_time"`
	Authorizations     []Authorization `json:"authorizations"`
	IsExtSharedChannel bool            `json:"is_ext_shared_channel"`
	EventContext       string          `json:"event_context"`
	Challenge          string          `json:"challenge"`
}

// Event represents the "event" field in the payload
type Event struct {
	Type            string `json:"type"`
	User            string `json:"user"`
	Channel         string `json:"channel"`
	MessageTS       string `json:"message_ts"`
	Links           []Link `json:"links"`
	Source          string `json:"source"`
	UnfurlID        string `json:"unfurl_id"`
	IsBotUserMember bool   `json:"is_bot_user_member"`
	EventTS         string `json:"event_ts"`
}

// Link represents the "links" field in the event
type Link struct {
	URL    string `json:"url"`
	Domain string `json:"domain"`
}

type Text struct {
	Type string `json:"type,omitempty"`
	Text string `json:"text,omitempty"`
}

type ImageAccessory struct {
	Type     string `json:"type,omitempty"`
	Title    *Text  `json:"title,omitempty"`
	ImageURL string `json:"image_url,omitempty"`
	AltText  string `json:"alt_text,omitempty"`
}

type Element struct {
	Type     string `json:"type,omitempty"`
	Text     *Text  `json:"text,omitempty"`
	Style    string `json:"style,omitempty"`
	Value    string `json:"value,omitempty"`
	ActionID string `json:"action_id,omitempty"`
}

type Block struct {
	Type      string          `json:"type,omitempty"`
	Text      *Text           `json:"text,omitempty"`
	Accessory *ImageAccessory `json:"accessory,omitempty"`
	ImageURL  string          `json:"image_url,omitempty"`
	Title     *Text           `json:"title,omitempty"`
	AltText   string          `json:"alt_text,omitempty"`
	Elements  []Element       `json:"elements,omitempty"`
}

type Unfurl struct {
	Blocks []Block `json:"blocks,omitempty"`
}

type Unfurls map[string]Unfurl

type UnfurlEventPayload struct {
	//Source   string  `json:"source"`
	//UnfurlID string  `json:"unfurl_id"`
	//Token    string  `json:"token"`
	Channel string  `json:"channel,omitempty"`
	TS      string  `json:"ts,omitempty"`
	Unfurls Unfurls `json:"unfurls,omitempty"`
}
