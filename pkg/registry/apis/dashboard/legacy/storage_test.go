package legacy

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
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

// test that we use the save provisioning function if the file based provisioning is set
func TestWriteProvisioningEvent(t *testing.T) {
	dashData := &dashboards.Dashboard{
		Title:   "Test Dashboard",
		Version: 2,
	}
	dashBytes, err := json.Marshal(dashData)
	require.NoError(t, err)

	key := &resourcepb.ResourceKey{
		Group:     dashboard.DashboardResourceInfo.GroupResource().Group,
		Resource:  dashboard.DashboardResourceInfo.GroupResource().Resource,
		Name:      "test-dashboard",
		Namespace: "stacks-1",
	}

	res := &unstructured.Unstructured{
		Object: map[string]any{},
	}
	meta, err := utils.MetaAccessor(res)
	require.NoError(t, err)
	meta.SetManagerProperties(utils.ManagerProperties{
		Kind:     utils.ManagerKindClassicFP, //nolint:staticcheck
		Identity: "test-name",
	})
	meta.SetSourceProperties(utils.SourceProperties{
		Path:            "test-path",
		Checksum:        "test-checksum",
		TimestampMillis: 1000,
	})

	event := resource.WriteEvent{
		Type:   resourcepb.WatchEvent_ADDED,
		Key:    key,
		Object: meta,
		Value:  dashBytes,
	}

	mockStore := dashboards.NewFakeDashboardStore(t)
	mockStore.On("SaveProvisionedDashboard", mock.Anything, mock.Anything, mock.Anything).Return(dashData, nil)

	access := &dashboardSqlAccess{
		dashStore: mockStore,
		log:       log.New("test"),
	}

	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{})
	rv, err := access.WriteEvent(ctx, event)
	require.NoError(t, err)
	require.Equal(t, int64(2), rv)
	mockStore.AssertExpectations(t)
}
