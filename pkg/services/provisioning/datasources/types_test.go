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

func TestProvisioningAnnotations(t *testing.T) {
	tests := []struct {
		name       string
		ds         *upsertDataSourceFromConfig
		sourceFile string
		want       map[string]string
	}{
		{
			name:       "read only data source",
			ds:         &upsertDataSourceFromConfig{Name: "test"},
			sourceFile: "prometheus.yaml",
			want: map[string]string{
				utils.AnnoKeyManagerKind:     "classic-file-provisioning",
				utils.AnnoKeyManagerIdentity: "prometheus.yaml",
				utils.AnnoKeySourcePath:      "prometheus.yaml",
			},
		},
		{
			name:       "editable data source allows edits",
			ds:         &upsertDataSourceFromConfig{Name: "test", Editable: true},
			sourceFile: "prometheus.yaml",
			want: map[string]string{
				utils.AnnoKeyManagerKind:        "classic-file-provisioning",
				utils.AnnoKeyManagerIdentity:    "prometheus.yaml",
				utils.AnnoKeySourcePath:         "prometheus.yaml",
				utils.AnnoKeyManagerAllowsEdits: "true",
			},
		},
		{
			name: "classic file provisioning needs no identity",
			ds:   &upsertDataSourceFromConfig{Name: "test"},
			want: map[string]string{
				utils.AnnoKeyManagerKind: "classic-file-provisioning",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, provisioningAnnotations(tt.ds, tt.sourceFile))
		})
	}
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
