package api

import (
	"strings"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/util"
)

// LiveHTTPHandler will process any requets to /api/live/*
func (hs *HTTPServer) LiveHTTPHandler(c *models.ReqContext) {
	addr, ok := getChannelAddress(c.Req.Request.URL.Path)
	if !ok {
		c.JSON(400, util.DynMap{
			"message": "Invalid path",
		})
		return
	}

	// Fully qualified channel ($scope/$namespace/$path)
	if addr.IsValid() {
		id := addr.ToChannelID()
		channel, err := hs.Live.GetChannelHandler(id)
		if err == nil {
			channel.DoChannelHTTP(c, id)
		} else {
			c.JSON(400, util.DynMap{
				"message": err.Error(),
			})
		}
		return
	}

	// Namespace path ($scope/$namespace/)
	if addr.Namespace != "" {
		ns, err := hs.Live.GetChannelNamespace(addr.Scope, addr.Namespace)
		if err != nil {
			c.JSON(400, util.DynMap{
				"message": err.Error(),
			})
		} else {
			ns.DoNamespaceHTTP(c)
		}
		return
	}

	// Return simple JSON for anything
	c.JSON(404, util.DynMap{})
}

func getChannelAddress(path string) (live.ChannelAddress, bool) {
	idx := strings.Index(path, "/api/live/")
	if idx < 0 {
		return live.ChannelAddress{}, false
	}
	return live.ParseChannelAddress(path[(idx + len("/api/live/")):]), true
}
