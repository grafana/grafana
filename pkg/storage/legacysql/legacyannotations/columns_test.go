package legacyannotations

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// managerInColumns is the policy a table uses when it keeps the manager queryable.
var managerInColumns = NewPolicy(
	utils.AnnoKeyManagerKind,
	utils.AnnoKeyManagerIdentity,
	utils.AnnoKeyUpdatedTimestamp,
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
			columns.Read(managerInColumns, &metav1.ObjectMeta{Annotations: tt.annotations})
			require.Equal(t, tt.want, columns)

			// Writing back reproduces everything except what a column elsewhere owns.
			back := &metav1.ObjectMeta{}
			columns.Write(managerInColumns, back)
			for k, v := range tt.annotations {
				if managerInColumns.Derives(k) && k != utils.AnnoKeyManagerKind && k != utils.AnnoKeyManagerIdentity {
					require.NotContains(t, back.Annotations, k, "derived elsewhere")
					continue
				}
				require.Equal(t, v, back.Annotations[k])
			}
		})
	}
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
	columns.Write(managerInColumns, obj)

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
