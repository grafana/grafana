package api

import (
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"errors"

	"github.com/grafana/grafana/pkg/components/renderer"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func RenderToFile(c *middleware.Context) {
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

	dashurl := regexp.MustCompile(`^[^/?]+/dashboard`).ReplaceAllString(c.Params("*"), "dashboard")
	filetype := strings.Replace(regexp.MustCompile(`^[^/?]+/dashboard`).FindString(c.Params("*")), "/dashboard", "", 1)
	contenttype := "image/png"
	renderOpts := &renderer.RenderOpts{
		Url:       dashurl + queryParams,
		Width:     queryReader.Get("width", "800"),
		Height:    queryReader.Get("height", "400"),
		SessionId: c.Session.ID(),
		Timeout:   queryReader.Get("timeout", "30"),
	}

	switch {
		case filetype == "":
			contenttype = "image/png"
			filetype = "png"
		case regexp.MustCompile(`(?i)^png$`).MatchString(filetype):
			contenttype = "image/png"
			filetype = "png"
		case regexp.MustCompile(`(?i)^pdf$`).MatchString(filetype):
			contenttype = "application/pdf"
			filetype = "pdf"
		case regexp.MustCompile(`(?i)^(jpeg|jpg)$`).MatchString(filetype):
			contenttype = "image/jpeg"
			filetype = "jpg"
		case regexp.MustCompile(`(?i)^bmp$`).MatchString(filetype):
			contenttype = "image/bmp"
			filetype = "bmp"
		case regexp.MustCompile(`(?i)^ppm$`).MatchString(filetype):
			contenttype = "image/x-portable-pixmap"
			filetype = "ppm"
		default:
			c.Handle(500, "Failed to render to " + filetype + " format. Unsupported format.", errors.New("Unsupported format of file " + filetype))
		return
	}

	renderOpts.Url = setting.ToAbsUrl(renderOpts.Url)
	filePath, err := renderer.RenderToFile(renderOpts, filetype)

	if err != nil {
		c.Handle(500, "Failed to render to " + filetype, err)
		return
	}
	
	c.Resp.Header().Set("Content-Type", contenttype)
	http.ServeFile(c.Resp, c.Req.Request, filePath)
}