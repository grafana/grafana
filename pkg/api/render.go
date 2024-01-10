package api

import (
	"errors"
	"fmt"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models/roletype"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) RenderToPng(c *contextmodel.ReqContext) {
	queryReader, err := util.NewURLQueryReader(c.Req.URL)
	if err != nil {
		c.Handle(hs.Cfg, 400, "Render parameters error", err)
		return
	}

	queryParams := fmt.Sprintf("?%s", c.Req.URL.RawQuery)

	width, err := strconv.Atoi(queryReader.Get("width", "800"))
	if err != nil {
		c.Handle(hs.Cfg, 400, "Render parameters error", fmt.Errorf("cannot parse width as int: %s", err))
		return
	}

	height, err := strconv.Atoi(queryReader.Get("height", "400"))
	if err != nil {
		c.Handle(hs.Cfg, 400, "Render parameters error", fmt.Errorf("cannot parse height as int: %s", err))
		return
	}

	timeout, err := strconv.Atoi(queryReader.Get("timeout", "60"))
	if err != nil {
		c.Handle(hs.Cfg, 400, "Render parameters error", fmt.Errorf("cannot parse timeout as int: %s", err))
		return
	}

	scale, err := strconv.ParseFloat(queryReader.Get("scale", "1"), 64)
	if err != nil {
		c.Handle(hs.Cfg, 400, "Render parameters error", fmt.Errorf("cannot parse scale as float: %s", err))
		return
	}

	headers := http.Header{}
	acceptLanguageHeader := c.Req.Header.Values("Accept-Language")
	if len(acceptLanguageHeader) > 0 {
		headers["Accept-Language"] = acceptLanguageHeader
	}

	userID, errID := identity.UserIdentifier(c.SignedInUser.GetNamespacedID())
	if errID != nil {
		hs.log.Error("Failed to parse user id", "err", errID)
	}

	result, err := hs.RenderService.Render(c.Req.Context(), rendering.Opts{
		TimeoutOpts: rendering.TimeoutOpts{
			Timeout: time.Duration(timeout) * time.Second,
		},
		AuthOpts: rendering.AuthOpts{
			OrgID:   c.SignedInUser.GetOrgID(),
			UserID:  userID,
			OrgRole: c.SignedInUser.GetOrgRole(),
		},
		Width:             width,
		Height:            height,
		Path:              web.Params(c.Req)["*"] + queryParams,
		Timezone:          queryReader.Get("tz", ""),
		Encoding:          queryReader.Get("encoding", ""),
		ConcurrentLimit:   hs.Cfg.RendererConcurrentRequestLimit,
		DeviceScaleFactor: scale,
		Headers:           headers,
		Theme:             models.ThemeDark,
	}, nil)
	if err != nil {
		if errors.Is(err, rendering.ErrTimeout) {
			c.Handle(hs.Cfg, 500, err.Error(), err)
			return
		}

		c.Handle(hs.Cfg, 500, "Rendering failed.", err)
		return
	}

	c.Resp.Header().Set("Content-Type", "image/png")
	c.Resp.Header().Set("Cache-Control", "private")
	http.ServeFile(c.Resp, c.Req, result.FilePath)
}

// TODO: this method should be splitted to reuse the service call
func (hs *HTTPServer) RenderAndPostToSlack(c *contextmodel.ReqContext) response.Response {
	// TODO: hardcoded for now, the input of this method should be the event payload
	source := "conversations_history"
	unfurlID := "12345"
	rawURL := "http://localhost:3000/render/d/RvNCUVm4z/dashboard-with-expressions?orgId=1&from=1704891104021&to=1704912704021&width=1000&height=500&tz=America%2FBuenos_Aires"

	var renderPath string
	// Find the index of "/d/"
	index := strings.Index(rawURL, "/d/")

	// Check if "/d/" was found
	if index != -1 {
		// Extract the substring including "/d/"
		renderPath = rawURL[index+1:]
		fmt.Println(renderPath)
	} else {
		return response.Error(http.StatusBadRequest, "Invalid dashboard url", fmt.Errorf("Invalid dashboard url"))
	}

	result, err := hs.RenderService.Render(c.Req.Context(), rendering.Opts{
		TimeoutOpts: rendering.TimeoutOpts{
			Timeout: time.Duration(60) * time.Second,
		},
		AuthOpts: rendering.AuthOpts{
			// TODO: get the org id from the URL
			OrgID: 1,
			// TODO:  which user should we use here?
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
		if errors.Is(err, rendering.ErrTimeout) {
			return response.Error(http.StatusInternalServerError, err.Error(), err)
		}

		c.Handle(hs.Cfg, 500, "Rendering failed.", err)
		return response.Error(http.StatusInternalServerError, "Rendering failed", err)
	}

	// build the request
	eventPayload := &SlackEventPayload{
		Source:   source,
		UnfurlID: unfurlID,
		Unfurls: Unfurls{
			rawURL: {
				Blocks: []Block{
					{
						Type: "section",
						Text: Text{
							Type: "mrkdwn",
							Text: "This is a fake event payload!",
						},
						Accessory: ImageAccessory{
							Type:     "image",
							ImageURL: result.FilePath,
							AltText:  "Fake Image",
						},
					},
				},
			},
			// Add more fake unfurls as needed
		},
	}
	// post to slack api
	hs.log.Info("Posting to slack api", "eventPayload", eventPayload)

	// TODO: this is for testing purposes but it should not return the payload
	return response.JSON(http.StatusOK, eventPayload)
}

type Text struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type ImageAccessory struct {
	Type     string `json:"type"`
	ImageURL string `json:"image_url"`
	AltText  string `json:"alt_text"`
}

type Block struct {
	Type      string         `json:"type"`
	Text      Text           `json:"text"`
	Accessory ImageAccessory `json:"accessory"`
}

type Unfurl struct {
	Blocks []Block `json:"blocks"`
}

type Unfurls map[string]Unfurl

type SlackEventPayload struct {
	Source   string  `json:"source"`
	UnfurlID string  `json:"unfurl_id"`
	Unfurls  Unfurls `json:"unfurls"`
}
