package api

import (
	"bytes"
	"context"
	"fmt"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/screenshot"
	"github.com/grafana/grafana/pkg/services/slack"
	"github.com/grafana/grafana/pkg/services/slack/model"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"regexp"
	"strconv"
)

type Api struct {
	slackService  slack.Service
	accessControl accesscontrol.AccessControl
	cfg           *setting.Cfg
	features      featuremgmt.FeatureToggles
	routeRegister routing.RouteRegister
	log           log.Logger
}

func ProvideApi(
	ss slack.Service,
	rr routing.RouteRegister,
	ac accesscontrol.AccessControl,
	features featuremgmt.FeatureToggles,
	cfg *setting.Cfg,
) *Api {
	api := &Api{
		slackService:  ss,
		accessControl: ac,
		cfg:           cfg,
		features:      features,
		routeRegister: rr,
		log:           log.New("slack.api"),
	}

	if features.IsEnabledGlobally(featuremgmt.FlagSlackUnfurling) {
		api.routeRegister.Post("/api/share/slack/unfurl", middleware.ReqSignedIn, routing.Wrap(api.SlackUnfurl))
	}

	if features.IsEnabledGlobally(featuremgmt.FlagSlackSharePreview) {
		api.routeRegister.Get("/api/share/slack/channels", middleware.ReqSignedIn, routing.Wrap(api.GetSlackChannels))
		api.routeRegister.Post("/api/share/slack", middleware.ReqSignedIn, routing.Wrap(api.ShareToSlack))
	}

	return api
}

// swagger:route GET /api/share/slack/channels slack getSlackChannels
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
func (api *Api) GetSlackChannels(c *contextmodel.ReqContext) response.Response {
	channels, err := api.slackService.GetUserConversations(c.Req.Context())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "could not retrieve Slack channels", err)
	}

	return response.JSON(http.StatusOK, channels.Channels)
}

// swagger:route POST /api/share/slack slack shareToSlack
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
func (api *Api) ShareToSlack(c *contextmodel.ReqContext) response.Response {
	var shareRequest dtos.ShareRequest
	if err := web.Bind(c.Req, &shareRequest); err != nil {
		return response.Error(http.StatusBadRequest, "error parsing body", err)
	}

	grafanaURL := api.getGrafanaURL()
	resourceLink := fmt.Sprintf("%s%s", grafanaURL, shareRequest.ResourcePath)

	err := api.slackService.PostMessage(c.Req.Context(), shareRequest, resourceLink)
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
func (api *Api) SlackUnfurl(c *contextmodel.ReqContext) response.Response {
	rawBody, err := io.ReadAll(c.Req.Body)
	if err != nil {
		return response.Error(http.StatusBadRequest, "error reading body", err)
	}

	// Restore the original body for further processing
	c.Req.Body = io.NopCloser(bytes.NewBuffer(rawBody))

	var eventPayload model.EventPayload
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
			if !api.slackService.ValidateSignatureRequest(c, string(rawBody)) {
				return response.Error(http.StatusBadRequest, "invalid signature", fmt.Errorf("invalid signature"))
			}
			defer api.handleLinkSharedEvent(c, eventPayload)
			return response.Empty(http.StatusOK)
		}
	}

	return response.Error(http.StatusBadRequest, "not handling this event type", fmt.Errorf("not handling this event type"))
}

func (api *Api) handleLinkSharedEvent(c *contextmodel.ReqContext, event model.EventPayload) {
	ctx := context.Background()

	// TODO: handle multiple links
	dashboardUID := extractDashboardUid(event.Event.Links[0].URL)
	previewUrl, err := url.Parse(event.Event.Links[0].URL)
	if err != nil {
		api.log.Error("fail to parse url")
		return
	}
	q := previewUrl.Query()
	panelId, _ := strconv.ParseInt(q.Get("panelId"), 10, 64)

	opts := screenshot.ScreenshotOptions{
		AuthOptions: rendering.AuthOpts{
			//UserID:  c.SignedInUser.UserID,
			OrgID:   1,
			OrgRole: roletype.RoleAdmin,
		},
		DashboardUID: dashboardUID,
		PanelID:      panelId,
		From:         q.Get("from"),
		To:           q.Get("to"),
	}

	imagePath, err := api.slackService.TakeScreenshot(ctx, opts)
	if err != nil {
		api.log.Error("fail to render dashboard for Slack preview", "err", err)
		return
	}

	imageURL := api.getImageURL(filepath.Base(imagePath))
	err = api.slackService.PostUnfurl(ctx, event, imageURL, "saraza")
	if err != nil {
		api.log.Error("fail to send unfurl event to Slack", "err", err)
	}
}

// extractDashboardUid returns the dashboard UID
func extractDashboardUid(dashboardURL string) string {
	re := regexp.MustCompile(`.*(\/d\/([^\/]*)\/.*)`)
	res := re.FindStringSubmatch(dashboardURL)
	if len(res) != 3 {
		return ""
	}

	return res[2]
}

// TODO: Duplicated from the rendering service - maybe we can do this in another way to not duplicate this
func (api *Api) getGrafanaURL() string {
	if api.cfg.RendererCallbackUrl != "" {
		return api.cfg.RendererCallbackUrl
	}

	protocol := api.cfg.Protocol
	switch protocol {
	case setting.HTTPScheme:
		protocol = "http"
	case setting.HTTP2Scheme, setting.HTTPSScheme:
		protocol = "https"
	default:
		// TODO: Handle other schemes?
	}

	subPath := ""
	if api.cfg.ServeFromSubPath {
		subPath = api.cfg.AppSubURL
	}

	domain := "localhost"
	if api.cfg.HTTPAddr != "0.0.0.0" {
		domain = api.cfg.HTTPAddr
	}
	return fmt.Sprintf("%s://%s:%s%s/", protocol, domain, api.cfg.HTTPPort, subPath)
}

func (api *Api) getImageURL(imageName string) string {
	grafanaURL := api.getGrafanaURL()
	return fmt.Sprintf("%s%s/%s", grafanaURL, "public/img/attachments", imageName)
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
	Body model.EventPayload `json:"body"`
}
