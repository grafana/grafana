package api

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
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
		c.Handle(hs.Cfg, http.StatusBadRequest, "Render parameters error", err)
		return
	}

	queryParams := fmt.Sprintf("?%s", c.Req.URL.RawQuery)

	width := c.QueryInt("width")
	if width == 0 {
		width = hs.Cfg.RendererDefaultImageWidth
	}

	height := c.QueryInt("height")
	if height == 0 {
		height = hs.Cfg.RendererDefaultImageHeight
	}

	timeout, err := strconv.Atoi(queryReader.Get("timeout", "60"))
	if err != nil {
		c.Handle(hs.Cfg, http.StatusBadRequest, "Render parameters error", fmt.Errorf("cannot parse timeout as int: %s", err))
		return
	}

	scale := c.QueryFloat64("scale")
	if scale == 0 {
		scale = hs.Cfg.RendererDefaultImageScale
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

	encoding := queryReader.Get("encoding", "")

	result, err := hs.RenderService.Render(c.Req.Context(), rendering.RenderPNG, rendering.Opts{
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
		Encoding:          encoding,
		ConcurrentLimit:   hs.Cfg.RendererConcurrentRequestLimit,
		DeviceScaleFactor: scale,
		Headers:           headers,
		Theme:             models.ThemeDark,
	}, nil)
	if err != nil {
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
