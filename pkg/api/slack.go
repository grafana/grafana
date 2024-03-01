package api

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"regexp"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/models/roletype"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/slack"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

// swagger:route GET /share/slack/channels slack getSlackChannels
//
// # Get Slack channels
//
// Will return a list of Slack channels available for posting messages.
//
// Responses:
// 200: slackChannelsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) GetSlackChannels(c *contextmodel.ReqContext) response.Response {
	channels, err := hs.slackService.GetUserConversations(c.Req.Context())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "could not retrieve Slack channels", err)
	}

	return response.JSON(http.StatusOK, channels.Channels)
}

// swagger:route POST /share/slack slack shareToSlack
//
// # Post message to Slack
//
// Will post a message to Slack.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) ShareToSlack(c *contextmodel.ReqContext) response.Response {
	var shareRequest dtos.ShareRequest
	if err := web.Bind(c.Req, &shareRequest); err != nil {
		return response.Error(http.StatusBadRequest, "error parsing body", err)
	}

	grafanaURL := hs.getGrafanaURL()
	resourceLink := fmt.Sprintf("%s%s", grafanaURL, shareRequest.ResourcePath)

	err := hs.slackService.PostMessage(c.Req.Context(), shareRequest, resourceLink)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Error posting message to Slack", err)
	}

	return response.Empty(http.StatusOK)
}

// swagger:route POST /share/slack/unfurl slack slackUnfurl
//
// # Post message to Slack
//
// Will post a message to Slack.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) SlackUnfurl(c *contextmodel.ReqContext) response.Response {
	rawBody, err := io.ReadAll(c.Req.Body)
	if err != nil {
		return response.Error(http.StatusBadRequest, "error reading body", err)
	}

	// Restore the original body for further processing
	c.Req.Body = io.NopCloser(bytes.NewBuffer(rawBody))

	var eventPayload slack.EventPayload
	if err := web.Bind(c.Req, &eventPayload); err != nil {
		return response.Error(http.StatusBadRequest, "error parsing body", err)
	}

	switch eventPayload.Type {
	case "url_verification":
		return response.JSON(http.StatusOK, &EventChallengeAck{
			Challenge: eventPayload.Challenge,
		})
	case "event_callback":
		if eventPayload.Event.Type == "link_shared" && eventPayload.Event.Source == "conversations_history" {
			if !hs.slackService.ValidateSignatureRequest(c, string(rawBody)) {
				return response.Error(http.StatusBadRequest, "invalid signature", fmt.Errorf("invalid signature"))
			}
			defer hs.handleLinkSharedEvent(eventPayload)
			return response.Empty(http.StatusOK)
		}
	}

	return response.Error(http.StatusBadRequest, "not handling this event type", fmt.Errorf("not handling this event type"))
}

func (hs *HTTPServer) handleLinkSharedEvent(event slack.EventPayload) {
	ctx := context.Background()

	// TODO: handle multiple links
	renderPath, dashboardUID := extractURLInfo(event.Event.Links[0].URL)
	if renderPath == "" {
		hs.log.Error("fail to extract render path from link")
		return
	}

	dashboard, err := hs.DashboardService.GetDashboard(ctx, &dashboards.GetDashboardQuery{UID: dashboardUID})
	if err != nil {
		hs.log.Error("fail to get dashboard", "err", err, "dashboard UID", dashboardUID)
		return
	}

	imagePath, err := hs.renderDashboard(ctx, renderPath)
	if err != nil {
		hs.log.Error("fail to render dashboard for Slack preview", "err", err)
		return
	}

	imageURL := hs.getImageURL(filepath.Base(imagePath))
	err = hs.slackService.PostUnfurl(ctx, event, imageURL, dashboard.Title)
	if err != nil {
		hs.log.Error("fail to send unfurl event to Slack", "err", err)
	}
}

// extractURLInfo returns the render path and the dashboard UID
func extractURLInfo(dashboardURL string) (string, string) {
	re := regexp.MustCompile(`.*(\/d\/([^\/]*)\/.*)`)
	res := re.FindStringSubmatch(dashboardURL)
	if len(res) != 3 {
		return "", ""
	}

	return res[1], res[2]
}

func (hs *HTTPServer) renderDashboard(ctx context.Context, renderPath string) (string, error) {
	result, err := hs.RenderService.Render(ctx, rendering.RenderPNG, rendering.Opts{
		TimeoutOpts: rendering.TimeoutOpts{
			Timeout: time.Duration(60) * time.Second,
		},
		AuthOpts: rendering.AuthOpts{
			// TODO: get the org id from the URL
			OrgID: 1,
			// TODO: get the user id from the signedInUser in sharing from Grafana and create a user when unfurling
			UserID:  1,
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

func (hs *HTTPServer) GeneratePreview(c *contextmodel.ReqContext) response.Response {
	var previewRequest PreviewRequest
	if err := web.Bind(c.Req, &previewRequest); err != nil {
		return response.Error(http.StatusBadRequest, "error parsing body", err)
	}

	hs.log.Info("Generating preview", "resourcePath", previewRequest.ResourcePath)

	filePath, err := hs.renderDashboard(c.Req.Context(), previewRequest.ResourcePath)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Rendering failed", err)
	}

	imageFileName := filepath.Base(filePath)
	imageURL := hs.getImageURL(imageFileName)

	return response.JSON(http.StatusOK, &PreviewResponse{
		PreviewURL: imageURL,
	})
}

// TODO: Duplicated from the rendering service - maybe we can do this in another way to not duplicate this
func (hs *HTTPServer) getGrafanaURL() string {
	if hs.Cfg.RendererCallbackUrl != "" {
		return hs.Cfg.RendererCallbackUrl
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
	return fmt.Sprintf("%s://%s:%s%s/", protocol, domain, hs.Cfg.HTTPPort, subPath)
}

func (hs *HTTPServer) getImageURL(imageName string) string {
	grafanaURL := hs.getGrafanaURL()
	return fmt.Sprintf("%s%s/%s", grafanaURL, "public/img/attachments", imageName)
}

type PreviewRequest struct {
	ResourcePath string `json:"resourcePath"`
}

type PreviewResponse struct {
	PreviewURL string `json:"previewUrl"`
}

type EventChallengeAck struct {
	Challenge string `json:"challenge"`
}

// swagger:response slackChannelsResponse
type SlackChannelsResponse struct {
	// in: body
	Body dtos.SlackChannels
}

// swagger:parameters shareToSlack
type ShareToSlack struct {
	// in:body
	// required:true
	Body dtos.ShareRequest `json:"body"`
}

// swagger:parameters slackUnfurl
type SlackUnfurl struct {
	// in:body
	// required:true
	Body slack.EventPayload `json:"body"`
}
