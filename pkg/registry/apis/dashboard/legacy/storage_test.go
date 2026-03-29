package legacy

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestGetProvisioningDataFromEvent(t *testing.T) {
	tests := []struct {
		name    string
		manager utils.ManagerProperties
		source  utils.SourceProperties
		want    *dashboards.DashboardProvisioning
	}{
		{
			name: "valid provisioning data",
			manager: utils.ManagerProperties{
				Kind:     utils.ManagerKindClassicFP, //nolint:staticcheck
				Identity: "test-name",
			},
			source: utils.SourceProperties{
				Path:            "test-path",
				Checksum:        "test-checksum",
				TimestampMillis: 1000,
			},
			want: &dashboards.DashboardProvisioning{
				Name:       "test-name",
				ExternalID: "test-path",
				CheckSum:   "test-checksum",
				Updated:    1,
			},
		},
		{
			name: "non-provisioned dashboard",
			manager: utils.ManagerProperties{
				Kind: "different-kind",
			},
			source: utils.SourceProperties{},
			want:   nil,
		},
		{
			name:    "missing runtime object",
			manager: utils.ManagerProperties{},
			source:  utils.SourceProperties{},
			want:    nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res := &unstructured.Unstructured{
				Object: map[string]any{},
			}
			meta, err := utils.MetaAccessor(res)
			require.NoError(t, err)
			meta.SetManagerProperties(tt.manager)
			meta.SetSourceProperties(tt.source)
			got, err := getProvisioningDataFromEvent(resource.WriteEvent{
				Object: meta,
			})
			require.NoError(t, err)
			require.Equal(t, tt.want, got)
		})
	}
}
