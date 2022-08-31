package store

import (
	"strings"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/web"
)

func splitFirstSegment(path string) (string, string) {
	idx := strings.Index(path, "/")
	if idx == 0 {
		path = path[1:]
		idx = strings.Index(path, "/")
	}

	if idx > 0 {
		return path[:idx], path[idx+1:]
	}
	return path, ""
}

func getPathAndScope(c *models.ReqContext) (string, string) {
	params := web.Params(c.Req)
	path := params["*"]
	if path == "" {
		return "", ""
	}
	return splitFirstSegment(path)
}

func getFirstSegment(path string) string {
	firstSegment, _ := splitFirstSegment(path)
	return firstSegment
}
