package migrate

import (
	"strings"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func isEmptyRepo(tree []repository.FileTreeEntry) bool {
	for _, item := range tree {
		if strings.HasPrefix(item.Path, ".") {
			continue
		}
		if !item.Blob {
			return false // found a folder!
		}
		if !resources.ShouldIgnorePath(item.Path) {
			return false // has a json or yaml
		}
	}
	return true
}
