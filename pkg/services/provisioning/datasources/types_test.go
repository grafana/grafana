package datasources

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/storage/legacysql/legacyannotations"
)

func TestUIDFromNames(t *testing.T) {
	t.Run("generate safe uid from name", func(t *testing.T) {
		require.Equal(t, safeUIDFromName("Hello world"), "P64EC88CA00B268E5")
		require.Equal(t, safeUIDFromName("Hello World"), "PA591A6D40BF42040")
		require.Equal(t, safeUIDFromName("AAA"), "PCB1AD2119D8FAFB6")
	})
}

func TestCreateUpdateCommand(t *testing.T) {
	t.Run("includes the version in the command", func(t *testing.T) {
		ds := &upsertDataSourceFromConfig{OrgID: 1, Version: 1, Name: "test"}
		cmd := createUpdateCommand(ds, 1, "prometheus.yaml")
		require.Equal(t, 1, cmd.Version)
	})
}

func TestProvisioningCommandsCarryTheManager(t *testing.T) {
	// Reads resolve the manager from its columns, so leaving it in the blob makes a
	// file-provisioned data source look unmanaged to /apis.
	want := legacyannotations.Columns{
		ManagerKind:     "file-provisioning",
		ManagerIdentity: "prometheus.yaml",
		Annotations: map[string]string{
			utils.AnnoKeySourcePath:         "prometheus.yaml",
			utils.AnnoKeyManagerAllowsEdits: "true",
		},
	}
	ds := &upsertDataSourceFromConfig{OrgID: 1, Name: "test", Editable: true}

	require.Equal(t, want, createInsertCommand(ds, "prometheus.yaml").Columns)

	update := createUpdateCommand(ds, 1, "prometheus.yaml")
	require.Equal(t, want, update.Columns)
	require.True(t, update.UpdateAnnotations, "the file is the source of truth on every boot")

	t.Run("a config without editable allows no edits", func(t *testing.T) {
		readOnly := createInsertCommand(&upsertDataSourceFromConfig{Name: "test"}, "prometheus.yaml")
		require.NotContains(t, readOnly.Annotations, utils.AnnoKeyManagerAllowsEdits)
	})

	t.Run("a config with no file records no identity", func(t *testing.T) {
		noFile := createInsertCommand(&upsertDataSourceFromConfig{Name: "test"}, "")
		require.Equal(t, "file-provisioning", noFile.ManagerKind)
		require.Empty(t, noFile.ManagerIdentity)
		require.Empty(t, noFile.Annotations)
	})
}

func TestManagedElsewhere(t *testing.T) {
	tests := []struct {
		kind string
		want bool
	}{
		{kind: "", want: false},
		{kind: "classic-file-provisioning", want: false},
		{kind: "file-provisioning", want: false},
		{kind: "repo", want: true},
		{kind: "terraform", want: true},
		{kind: "kubectl", want: true},
		{kind: "something-else", want: false}, // unparseable reads as unmanaged
	}

	for _, tt := range tests {
		t.Run(tt.kind, func(t *testing.T) {
			require.Equal(t, tt.want, managedElsewhere(&datasources.DataSource{Columns: legacyannotations.Columns{ManagerKind: tt.kind}}))
		})
	}
}
