package store

import (
	"strings"
)

func SplitFirstSegment(path string) (string, string) {
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
