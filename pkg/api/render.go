package api

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/models"
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

	result, err := hs.RenderService.Render(c.Req.Context(), rendering.Opts{
		TimeoutOpts: rendering.TimeoutOpts{
			Timeout: time.Duration(timeout) * time.Second,
		},
		AuthOpts: rendering.AuthOpts{
			OrgID:   c.OrgID,
			UserID:  c.UserID,
			OrgRole: c.OrgRole,
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
	http.ServeFile(c.Resp, c.Req, result.FilePath)
}
