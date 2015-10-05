package api

import (
	"fmt"
	"net/http"

	"github.com/Cepave/grafana/pkg/components/renderer"
	"github.com/Cepave/grafana/pkg/middleware"
	"github.com/Cepave/grafana/pkg/setting"
	"github.com/Cepave/grafana/pkg/util"
)

func RenderToPng(c *middleware.Context) {
	queryReader := util.NewUrlQueryReader(c.Req.URL)
	queryParams := fmt.Sprintf("?%s", c.Req.URL.RawQuery)
	sessionId := c.Session.ID()

	// Handle api calls authenticated without session
	if sessionId == "" && c.ApiKeyId != 0 {
		c.Session.Start(c)
		c.Session.Set(middleware.SESS_KEY_APIKEY, c.ApiKeyId)
		// release will make sure the new session is persisted before
		// we spin up phantomjs
		c.Session.Release()
		// cleanup session after render is complete
		defer func() { c.Session.Destory(c) }()
	}

	renderOpts := &renderer.RenderOpts{
		Url:       c.Params("*") + queryParams,
		Width:     queryReader.Get("width", "800"),
		Height:    queryReader.Get("height", "400"),
		SessionId: c.Session.ID(),
	}

	renderOpts.Url = setting.ToAbsUrl(renderOpts.Url)
	pngPath, err := renderer.RenderToPng(renderOpts)

	if err != nil {
		c.Handle(500, "Failed to render to png", err)
		return
	}

	c.Resp.Header().Set("Content-Type", "image/png")
	http.ServeFile(c.Resp, c.Req.Request, pngPath)
}
