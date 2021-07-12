// +build linux

package dashboards

import (
	"path/filepath"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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

	reader, err := NewDashboardFileReader(cfg, log.New("test-logger"), nil)
	if err != nil {
		t.Error("expected err to be nil")
	}

	want, err := filepath.Abs(containingID)
	require.NoError(t, err)

	resolvedPath := reader.resolvedPath()
	assert.Equal(t, want, resolvedPath)
}
