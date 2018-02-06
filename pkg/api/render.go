package api

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"strconv"

	"github.com/grafana/grafana/pkg/components/renderer"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/util"
)

func RenderToPng(c *middleware.Context) {
	queryReader, err := util.NewUrlQueryReader(c.Req.URL)
	if err != nil {
		c.Handle(400, "Render parameters error", err)
		return
	}
	queryParams := fmt.Sprintf("?%s", c.Req.URL.RawQuery)

	width, err := strconv.Atoi(queryReader.Get("width", "800"))
	if err != nil {
		c.Handle(400, "Render parameters error", fmt.Errorf("Cannot parse width as int: %s", err))
		return
	}

	height, err := strconv.Atoi(queryReader.Get("height", "400"))
	if err != nil {
		c.Handle(400, "Render parameters error", fmt.Errorf("Cannot parse height as int: %s", err))
		return
	}

	timeout, err := strconv.Atoi(queryReader.Get("timeout", "60"))
	if err != nil {
		c.Handle(400, "Render parameters error", fmt.Errorf("Cannot parse timeout as int: %s", err))
		return
	}

	if queryReader.Get("tz", "") != "" || queryReader.Get("encoding", "") != "" {
		c.Handle(400, "Unsupported parameter", errors.New("Unsupport query parameters tz or encoding"))
		return
	}

	pngPath, err := renderer.Render(renderer.Opts{
		Width:   width,
		Height:  height,
		Timeout: time.Duration(timeout) * time.Second,
		OrgID:   c.OrgId,
		UserID:  c.UserId,
		OrgRole: c.OrgRole,
		Path:    c.Params("*") + queryParams,
	})

	if err != nil && err == renderer.ErrTimeout {
		c.Handle(500, err.Error(), err)
		return
	}

	if err != nil {
		c.Handle(500, "Rendering failed.", err)
		return
	}

	c.Resp.Header().Set("Content-Type", "image/png")
	http.ServeFile(c.Resp, c.Req.Request, pngPath)
}
