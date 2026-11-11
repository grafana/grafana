package datasource

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
)

func TestCheckManagerPropertiesOnUpdate(t *testing.T) {
	resourceInfo := datasourceV0.DataSourceResourceInfo.WithGroupAndShortName("prometheus.datasource.grafana.app", "prometheus")
	store := &legacyStorage{resourceInfo: &resourceInfo}

	managedBy := func(kind utils.ManagerKind, identity string) *datasourceV0.DataSource {
		ds := &datasourceV0.DataSource{
			ObjectMeta: metav1.ObjectMeta{Name: "ds-uid", Namespace: "default"},
		}
		meta, err := utils.MetaAccessor(ds)
		require.NoError(t, err)
		meta.SetManagerProperties(utils.ManagerProperties{Kind: kind, Identity: identity})
		return ds
	}
	unmanaged := func() *datasourceV0.DataSource {
		return &datasourceV0.DataSource{ObjectMeta: metav1.ObjectMeta{Name: "ds-uid", Namespace: "default"}}
	}

	tests := []struct {
		name        string
		old         *datasourceV0.DataSource
		proposed    *datasourceV0.DataSource
		expectedErr string
	}{
		{
			name:     "unchanged manager",
			old:      managedBy(utils.ManagerKindRepo, "my-repo"),
			proposed: managedBy(utils.ManagerKindRepo, "my-repo"),
		},
		{
			name:        "kind change",
			old:         managedBy(utils.ManagerKindRepo, "my-repo"),
			proposed:    managedBy(utils.ManagerKindTerraform, "my-repo"),
			expectedErr: "Cannot change resource manager kind",
		},
		{
			name:        "identity change",
			old:         managedBy(utils.ManagerKindRepo, "my-repo"),
			proposed:    managedBy(utils.ManagerKindRepo, "other-repo"),
			expectedErr: "cannot change resource manager identity",
		},
		{
			name:     "terraform identity may move",
			old:      managedBy(utils.ManagerKindTerraform, "terraform-v1"),
			proposed: managedBy(utils.ManagerKindTerraform, "terraform-v2"),
		},
		{
			name:     "adopting an unmanaged data source",
			old:      unmanaged(),
			proposed: managedBy(utils.ManagerKindRepo, "my-repo"),
		},
		{
			name:     "releasing is left to the authorizer",
			old:      managedBy(utils.ManagerKindRepo, "my-repo"),
			proposed: unmanaged(),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := store.checkManagerPropertiesOnUpdate(tt.old, tt.proposed)
			if tt.expectedErr != "" {
				require.ErrorContains(t, err, tt.expectedErr)
				return
			}
			require.NoError(t, err)
		})
	}
}
