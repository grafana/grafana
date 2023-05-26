package store

import (
	"strings"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

func GuessNameFromUID(uid string) string {
	sidx := strings.LastIndex(uid, "/") + 1
	didx := strings.LastIndex(uid, ".")
	if didx > sidx && didx != sidx {
		return uid[sidx:didx]
	}
	if sidx > 0 {
		return uid[sidx:]
	}
	return uid
}

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

func getPathAndScope(c *contextmodel.ReqContext) (string, string) {
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
