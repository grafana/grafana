package dualwrite

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
)

func TestIsReadingLegacyDashboardsAndFolders(t *testing.T) {
	tests := []struct {
		name           string
		setupMockSvc   func(*MockService)
		expectedResult bool
	}{
		{
			name: "both folders and dashboards are read from unified storage",
			setupMockSvc: func(svc *MockService) {
				svc.On("ReadFromUnified", mock.Anything, folders.FolderResourceInfo.GroupResource()).Return(true, nil)
				svc.On("ReadFromUnified", mock.Anything, schema.GroupResource{
					Group:    dashboard.GROUP,
					Resource: dashboard.DASHBOARD_RESOURCE,
				}).Return(true, nil)
			},
			expectedResult: false,
		},
		{
			name: "only folders are read from unified storage",
			setupMockSvc: func(svc *MockService) {
				svc.On("ReadFromUnified", mock.Anything, folders.FolderResourceInfo.GroupResource()).Return(true, nil)
				svc.On("ReadFromUnified", mock.Anything, schema.GroupResource{
					Group:    dashboard.GROUP,
					Resource: dashboard.DASHBOARD_RESOURCE,
				}).Return(false, nil)
			},
			expectedResult: true,
		},
		{
			name: "only dashboards are read from unified storage",
			setupMockSvc: func(svc *MockService) {
				svc.On("ReadFromUnified", mock.Anything, folders.FolderResourceInfo.GroupResource()).Return(false, nil)
				svc.On("ReadFromUnified", mock.Anything, schema.GroupResource{
					Group:    dashboard.GROUP,
					Resource: dashboard.DASHBOARD_RESOURCE,
				}).Return(true, nil)
			},
			expectedResult: true,
		},
		{
			name: "neither folders nor dashboards are read from unified storage",
			setupMockSvc: func(svc *MockService) {
				svc.On("ReadFromUnified", mock.Anything, folders.FolderResourceInfo.GroupResource()).Return(false, nil)
				svc.On("ReadFromUnified", mock.Anything, schema.GroupResource{
					Group:    dashboard.GROUP,
					Resource: dashboard.DASHBOARD_RESOURCE,
				}).Return(false, nil)
			},
			expectedResult: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc := NewMockService(t)
			tt.setupMockSvc(mockSvc)

			result := IsReadingLegacyDashboardsAndFolders(context.Background(), mockSvc)
			require.Equal(t, tt.expectedResult, result)
		})
	}
}
