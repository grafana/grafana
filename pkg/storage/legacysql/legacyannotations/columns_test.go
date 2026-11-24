package legacyannotations

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestColumnsRoundTrip(t *testing.T) {
	tests := []struct {
		name        string
		annotations map[string]string
		want        Columns
	}{
		{
			name: "the manager goes to its columns, the rest to the blob",
			annotations: map[string]string{
				utils.AnnoKeyManagerKind:        string(utils.ManagerKindRepo),
				utils.AnnoKeyManagerIdentity:    "my-repo",
				utils.AnnoKeyManagerAllowsEdits: "true",
				utils.AnnoKeySourcePath:         "datasources/prom.yaml",
			},
			want: Columns{
				ManagerKind:     string(utils.ManagerKindRepo),
				ManagerIdentity: "my-repo",
				Annotations: map[string]string{
					utils.AnnoKeyManagerAllowsEdits: "true",
					utils.AnnoKeySourcePath:         "datasources/prom.yaml",
				},
			},
		},
		{
			name: "a derived annotation reaches neither",
			annotations: map[string]string{
				utils.AnnoKeyUpdatedTimestamp: "2026-01-01T00:00:00Z",
				utils.AnnoKeyManagerKind:      string(utils.ManagerKindTerraform),
				utils.AnnoKeyManagerIdentity:  "terraform-provider",
			},
			want: Columns{
				ManagerKind:     string(utils.ManagerKindTerraform),
				ManagerIdentity: "terraform-provider",
			},
		},
		{
			name:        "an unmanaged resource writes nothing",
			annotations: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var columns Columns
			columns.FromObject(&metav1.ObjectMeta{Annotations: tt.annotations})
			require.Equal(t, tt.want, columns)

			// Writing back reproduces everything except what a column elsewhere owns.
			back := &metav1.ObjectMeta{}
			columns.ToObject(back)
			for k, v := range tt.annotations {
				if defaultPolicy.derived[k] && k != utils.AnnoKeyManagerKind && k != utils.AnnoKeyManagerIdentity {
					require.NotContains(t, back.Annotations, k, "derived elsewhere")
					continue
				}
				require.Equal(t, v, back.Annotations[k])
			}
		})
	}
}

func TestColumnsAsAnnotations(t *testing.T) {
	columns := Columns{
		ManagerKind:     string(utils.ManagerKindRepo),
		ManagerIdentity: "my-repo",
		Annotations:     map[string]string{utils.AnnoKeySourcePath: "a.yaml", utils.AnnoKeyManagerKind: "stale"},
	}
	require.Equal(t, map[string]string{
		utils.AnnoKeyManagerKind:     "repo",
		utils.AnnoKeyManagerIdentity: "my-repo",
		utils.AnnoKeySourcePath:      "a.yaml",
	}, columns.AsAnnotations())
	require.Nil(t, Columns{}.AsAnnotations())
}

func TestColumnsWriteDoesNotLetTheBlobBeatTheColumn(t *testing.T) {
	// A row written before the manager had columns can still carry it in the blob.
	// The column has to win, or an old row would resurrect a stale manager.
	columns := Columns{
		ManagerKind:     string(utils.ManagerKindRepo),
		ManagerIdentity: "current-repo",
		Annotations:     map[string]string{utils.AnnoKeyManagerIdentity: "stale-repo"},
	}

	obj := &metav1.ObjectMeta{}
	columns.ToObject(obj)

	require.Equal(t, "current-repo", obj.Annotations[utils.AnnoKeyManagerIdentity])
}

func TestColumnsToWrite(t *testing.T) {
	var authoritative UpdateColumns
	authoritative.UpdateAnnotations = true
	require.Equal(t,
		[]string{annotationColumn, managerKindColumn, managerIdentityColumn},
		authoritative.ColumnsToWrite(),
		"an authoritative caller writes them even when empty, which is how they clear")

	var blind UpdateColumns
	require.Empty(t, blind.ColumnsToWrite(),
		"a caller that knows nothing about annotations leaves the stored ones alone")
}

func TestDefaultPolicyDropsWhatAClientCouldFill(t *testing.T) {
	policy := defaultPolicy
	obj := &metav1.ObjectMeta{Annotations: map[string]string{
		utils.AnnoKeyKubectlLastAppliedConfig: `{"secure":{"password":{"create":"hunter2"}}}`,
		utils.AnnoKeyCreatedBy:                "user:someone-else",
		utils.AnnoKeyUpdatedBy:                "user:someone-else",
		utils.AnnoKeySourcePath:               "datasources/prom.yaml",
	}}

	require.Equal(t, map[string]string{utils.AnnoKeySourcePath: "datasources/prom.yaml"},
		policy.toStore(obj), "a secret or an untrusted author never reaches the row")
}

func TestFileProvisioned(t *testing.T) {
	require.Equal(t, Columns{
		ManagerKind:     "file-provisioning",
		ManagerIdentity: "prometheus.yaml",
		Annotations: map[string]string{
			utils.AnnoKeySourcePath:         "prometheus.yaml",
			utils.AnnoKeyManagerAllowsEdits: "true",
		},
	}, FileProvisioned("prometheus.yaml", true))

	t.Run("a config without editable allows none", func(t *testing.T) {
		require.NotContains(t, FileProvisioned("prometheus.yaml", false).Annotations,
			utils.AnnoKeyManagerAllowsEdits)
	})

	t.Run("a classic kind needs no identity", func(t *testing.T) {
		columns := FileProvisioned("", false)
		require.Equal(t, "file-provisioning", columns.ManagerKind)
		require.Empty(t, columns.ManagerIdentity)
		require.Empty(t, columns.Annotations)
	})
}

func TestFileProvisionedUpdateIsAuthoritative(t *testing.T) {
	// A provisioner rewrites from the file on every boot, so a renamed config has to
	// replace the stored columns rather than merge into them.
	update := FileProvisionedUpdate("prometheus.yaml", false)
	require.True(t, update.UpdateAnnotations)
	require.Equal(t, FileProvisioned("prometheus.yaml", false), update.Columns)
	require.NotEmpty(t, update.ColumnsToWrite())
}
