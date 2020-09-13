// +build linux

package dashboards

import (
	"path/filepath"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
)

var (
	symlinkedFolder = "testdata/test-dashboards/symlink"
)

func TestProvisionedSymlinkedFolder(t *testing.T) {
	cfg := &config{
		Name:    "Default",
		Type:    "file",
		OrgID:   1,
		Folder:  "",
		Options: map[string]interface{}{"path": symlinkedFolder},
	}

	reader, err := NewDashboardFileReader(cfg, log.New("test-logger"))
	if err != nil {
		t.Error("expected err to be nil")
	}

	want, err := filepath.Abs(containingID)

	if err != nil {
		t.Errorf("expected err to be nil")
	}

	resolvedPath := reader.resolvedPath()
	if resolvedPath != want {
		t.Errorf("got %s want %s", resolvedPath, want)
	}
}
