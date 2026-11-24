package datasources

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/datasources"
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

func TestProvisioningManager(t *testing.T) {
	tests := []struct {
		name            string
		ds              *upsertDataSourceFromConfig
		sourceFile      string
		wantKind        string
		wantIdentity    string
		wantAnnotations map[string]string
	}{
		{
			name:         "read only data source",
			ds:           &upsertDataSourceFromConfig{Name: "test"},
			sourceFile:   "prometheus.yaml",
			wantKind:     "classic-file-provisioning",
			wantIdentity: "prometheus.yaml",
			wantAnnotations: map[string]string{
				utils.AnnoKeySourcePath: "prometheus.yaml",
			},
		},
		{
			name:         "editable data source allows edits",
			ds:           &upsertDataSourceFromConfig{Name: "test", Editable: true},
			sourceFile:   "prometheus.yaml",
			wantKind:     "classic-file-provisioning",
			wantIdentity: "prometheus.yaml",
			wantAnnotations: map[string]string{
				utils.AnnoKeySourcePath:         "prometheus.yaml",
				utils.AnnoKeyManagerAllowsEdits: "true",
			},
		},
		{
			name:     "classic file provisioning needs no identity",
			ds:       &upsertDataSourceFromConfig{Name: "test"},
			wantKind: "classic-file-provisioning",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			kind, identity, annotations := provisioningManager(tt.ds, tt.sourceFile)
			// The manager goes in columns, not the blob: a read resolves it from
			// there, so leaving it in the blob makes this look unmanaged to /apis.
			require.Equal(t, tt.wantKind, kind)
			require.Equal(t, tt.wantIdentity, identity)
			require.Equal(t, tt.wantAnnotations, annotations)
			require.NotContains(t, annotations, utils.AnnoKeyManagerKind)
			require.NotContains(t, annotations, utils.AnnoKeyManagerIdentity)
		})
	}
}

func TestProvisioningCommandsCarryTheManager(t *testing.T) {
	ds := &upsertDataSourceFromConfig{OrgID: 1, Name: "test", Editable: true}

	insert := createInsertCommand(ds, "prometheus.yaml")
	require.Equal(t, "classic-file-provisioning", insert.ManagerKind)
	require.Equal(t, "prometheus.yaml", insert.ManagerIdentity)
	require.Equal(t, "prometheus.yaml", insert.Annotations[utils.AnnoKeySourcePath])

	update := createUpdateCommand(ds, 1, "prometheus.yaml")
	require.Equal(t, "classic-file-provisioning", update.ManagerKind)
	require.Equal(t, "prometheus.yaml", update.ManagerIdentity)
	require.True(t, update.UpdateAnnotations)
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
			require.Equal(t, tt.want, managedElsewhere(&datasources.DataSource{ManagerKind: tt.kind}))
		})
	}
}
