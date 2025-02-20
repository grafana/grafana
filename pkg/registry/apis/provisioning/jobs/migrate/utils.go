package migrate

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// VerifyEmptyRepo -- checks if there is anything useable in the tree
func VerifyEmptyRepo(tree []repository.FileTreeEntry) error {
	var folders []string
	var files []string

	for _, item := range tree {
		if strings.HasPrefix(item.Path, ".") {
			continue
		}
		if !item.Blob {
			folders = append(folders, item.Path)
		} else if !resources.ShouldIgnorePath(item.Path) {
			files = append(files, item.Path)
		}
	}

	if len(folders) > 0 || len(files) > 0 {
		return fmt.Errorf("expected empty repository, but found %d files in %d folders", len(files), len(folders))
	}
	return nil
}
