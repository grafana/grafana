package api

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/models"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) RenderHandler(c *contextmodel.ReqContext) {
	cfg := hs.Cfg.Get()
	queryReader, err := util.NewURLQueryReader(c.Req.URL)
	if err != nil {
		c.Handle(hs.Cfg, http.StatusBadRequest, "Render parameters error", err)
		return
	}

	queryParams := fmt.Sprintf("?%s", c.Req.URL.RawQuery)

	width := c.QueryInt("width")
	if width == 0 {
		width = cfg.RendererDefaultImageWidth
	}

	height := c.QueryInt("height")
	if height == 0 {
		height = cfg.RendererDefaultImageHeight
	}

	timeout, err := strconv.Atoi(queryReader.Get("timeout", "60"))
	if err != nil {
		c.Handle(hs.Cfg, http.StatusBadRequest, "Render parameters error", fmt.Errorf("cannot parse timeout as int: %s", err))
		return
	}

	scale := c.QueryFloat64("scale")
	if scale == 0 {
		scale = cfg.RendererDefaultImageScale
	}

	theme := c.QueryStrings("theme")
	var themeModel models.Theme
	if len(theme) > 0 {
		themeStr := theme[0]
		_, err := models.ParseTheme(themeStr)
		if err != nil {
			c.Handle(hs.Cfg, http.StatusBadRequest, "Render parameters error: theme can only be light or dark", err)
			return
		}
		themeModel = models.Theme(themeStr)
	} else {
		themeModel = models.ThemeDark
	}

	headers := http.Header{}
	acceptLanguageHeader := c.Req.Header.Values("Accept-Language")
	if len(acceptLanguageHeader) > 0 {
		headers["Accept-Language"] = acceptLanguageHeader
	}

	userID, err := identity.UserIdentifier(c.GetID())
	if err != nil {
		hs.log.Debug("Failed to parse user id", "err", err)
	}

	encoding := queryReader.Get("encoding", "")

	renderType := rendering.RenderPNG
	if encoding == "pdf" {
		renderType = rendering.RenderPDF
	}

	result, err := hs.RenderService.Render(c.Req.Context(), renderType, rendering.Opts{
		CommonOpts: rendering.CommonOpts{
			TimeoutOpts: rendering.TimeoutOpts{
				Timeout: time.Duration(timeout) * time.Second,
			},
			AuthOpts: rendering.AuthOpts{
				OrgID:   c.GetOrgID(),
				UserID:  userID,
				OrgRole: c.GetOrgRole(),
			},
			Path:            web.Params(c.Req)["*"] + queryParams,
			Timezone:        queryReader.Get("tz", ""),
			ConcurrentLimit: cfg.RendererConcurrentRequestLimit,
			Headers:         headers,
		},
		Width:             width,
		Height:            height,
		DeviceScaleFactor: scale,
		Theme:             themeModel,
	}, nil)
	if err != nil {
		if errors.Is(err, rendering.ErrTooManyRequests) {
			c.JsonApiErr(http.StatusTooManyRequests, "Too many rendering requests", err)
			return
		}

		if errors.Is(err, rendering.ErrTimeout) {
			c.Handle(hs.Cfg, http.StatusInternalServerError, err.Error(), err)
			return
		}

		c.Handle(hs.Cfg, http.StatusInternalServerError, "Rendering failed.", err)
		return
	}

	if encoding == "pdf" {
		c.Resp.Header().Set("Content-Type", "application/pdf")
	} else {
		c.Resp.Header().Set("Content-Type", "image/png")
	}

	c.Resp.Header().Set("Cache-Control", "private")
	http.ServeFile(c.Resp, c.Req, result.FilePath)
}
