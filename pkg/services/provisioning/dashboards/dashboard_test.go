package dashboards

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestProvisioningHomeDashboard(t *testing.T) {

	t.Run("happy path", func(t *testing.T) {
		config := setting.NewCfg()
		config.DefaultHomeDashboardPath = "testdata/test-dashboards/dashboard-with-uid/dashboard1.json"
		provisioner, err := New(t.Context(), t.TempDir(), nil, config, nil, nil, nil, nil, nil)
		require.NoError(t, err)
		prov := provisioner.(*Provisioner)
		require.Len(t, prov.fileReaders, 1)
		reader := prov.fileReaders[0]
		require.Equal(t, reader.Path, "testdata/test-dashboards/dashboard-with-uid/dashboard1.json")
	})

	t.Run("Empty file path doesn't create file readers", func(t *testing.T) {
		config := setting.NewCfg()
		config.DefaultHomeDashboardPath = ""
		provisioner, err := New(t.Context(), t.TempDir(), nil, config, nil, nil, nil, nil, nil)
		require.NoError(t, err)
		prov := provisioner.(*Provisioner)
		require.Len(t, prov.fileReaders, 0)
	})
}
