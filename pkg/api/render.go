package api

import (
	"fmt"
	"net/http"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/util"
)

func (hs *HTTPServer) RenderToPng(c *models.ReqContext) {
	queryReader, err := util.NewURLQueryReader(c.Req.URL)
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

	maxConcurrentLimitForApiCalls := 30
	result, err := hs.RenderService.Render(c.Req.Context(), rendering.Opts{
		Width:           width,
		Height:          height,
		Timeout:         time.Duration(timeout) * time.Second,
		OrgId:           c.OrgId,
		UserId:          c.UserId,
		OrgRole:         c.OrgRole,
		Path:            c.Params("*") + queryParams,
		Timezone:        queryReader.Get("tz", ""),
		Encoding:        queryReader.Get("encoding", ""),
		ConcurrentLimit: maxConcurrentLimitForApiCalls,
	})

	if err != nil && err == rendering.ErrTimeout {
		c.Handle(500, err.Error(), err)
		return
	}

	if err != nil && err == rendering.ErrPhantomJSNotInstalled {
		if strings.HasPrefix(runtime.GOARCH, "arm") {
			c.Handle(500, "Rendering failed - PhantomJS isn't included in arm build per default", err)
		} else {
			c.Handle(500, "Rendering failed - PhantomJS isn't installed correctly", err)
		}
		return
	}

	if err != nil {
		c.Handle(500, "Rendering failed.", err)
		return
	}

	c.Resp.Header().Set("Content-Type", "image/png")
	http.ServeFile(c.Resp, c.Req.Request, result.FilePath)
}
