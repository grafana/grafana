package service

import (
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/stretchr/testify/require"
)

func Test_canBeAutomaticallyCleanedUp(t *testing.T) {
	testCases := []struct {
		name         string
		configs      []dashboards.ProvisioningConfig
		expectedSkip string
	}{
		{
			name:         "no dashboards defined in the configuration",
			configs:      []dashboards.ProvisioningConfig{},
			expectedSkip: "no provisioned dashboards",
		},
		{
			name: "first defined dashboard has no folder defined",
			configs: []dashboards.ProvisioningConfig{
				{Name: "1", Folder: ""},
				{Folder: "f1"},
			},
			expectedSkip: "dashboard has no folder: 1",
		},
		{
			name: "one of the provisioned dashboards has no folder defined",
			configs: []dashboards.ProvisioningConfig{
				{Name: "1", Folder: "f1"},
				{Name: "2", Folder: "f1"},
				{Name: "3", Folder: ""},
				{Name: "4", Folder: "f1"},
			},
			expectedSkip: "dashboards provisioned in different folders",
		},
		{
			name: "one of the provisioned dashboards allows UI updates",
			configs: []dashboards.ProvisioningConfig{
				{Name: "1", Folder: "f1"},
				{Name: "2", Folder: "f1", AllowUIUpdates: true},
				{Name: "3", Folder: "f1"},
				{Name: "4", Folder: "f1"},
			},
			expectedSkip: "contains dashboards with allowUiUpdates",
		},
		{
			name: "one of the provisioned dashboards is in a different folder",
			configs: []dashboards.ProvisioningConfig{
				{Name: "1", Folder: "f1"},
				{Name: "2", Folder: "f1"},
				{Name: "3", Folder: "f1"},
				{Name: "4", Folder: "different"},
			},
			expectedSkip: "dashboards provisioned in different folders",
		},
		{
			name: "can be skipped otherwise",
			configs: []dashboards.ProvisioningConfig{
				{Name: "1", Folder: "f1"},
				{Name: "2", Folder: "f1"},
				{Name: "3", Folder: "f1"},
				{Name: "4", Folder: "f1"},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.expectedSkip, canBeAutomaticallyCleanedUp(tc.configs))
		})
	}
}

func Test_cleanupSteps(t *testing.T) {
	isDashboard, isFolder := false, true

	fromUser := func(uid, name string, isFolder bool) dashboards.DashboardSearchProjection {
		return dashboards.DashboardSearchProjection{
			UID:       uid,
			ManagerId: name,
			IsFolder:  isFolder,
		}
	}

	provisioned := func(uid, name string, isFolder bool) dashboards.DashboardSearchProjection {
		dashboard := fromUser(uid, name, isFolder)
		dashboard.ManagedBy = utils.ManagerKindClassicFP //nolint:staticcheck
		return dashboard
	}

	testCases := []struct {
		name                 string
		provisionedFolders   []string
		provisionedResources []dashboards.DashboardSearchProjection
		configDashboards     []string
		expectedSteps        []deleteProvisionedResource
		expectedErr          string
	}{
		{
			name:               "no provisioned folders, nothing to do",
			provisionedFolders: []string{},
			configDashboards:   []string{"Provisioned1", "Provisioned2", "Provisioned3"},
			provisionedResources: []dashboards.DashboardSearchProjection{
				provisioned("d1", "Provisioned1", isDashboard),
			},
		},
		{
			name:               "multiple folders, a user-created dashboard in one of them",
			provisionedFolders: []string{"folder1", "folder2"},
			configDashboards:   []string{"Provisioned1", "Provisioned2", "Provisioned3"},
			provisionedResources: []dashboards.DashboardSearchProjection{
				provisioned("d1", "Provisioned1", isDashboard),
				provisioned("d2", "Provisioned2", isDashboard),
				fromUser("d3", "User1", isDashboard),
				provisioned("d4", "Provisioned3", isDashboard),
			},
			expectedErr: "multiple provisioning folders exist with at least one user-created resource",
		},
		{
			name:               "multiple folders, a user-created folder in one of them",
			provisionedFolders: []string{"folder1", "folder2"},
			configDashboards:   []string{"Provisioned1", "Provisioned2", "Provisioned3", "Provisioned4"},
			provisionedResources: []dashboards.DashboardSearchProjection{
				provisioned("d1", "Provisioned1", isDashboard),
				provisioned("d2", "Provisioned2", isDashboard),
				provisioned("d3", "Provisioned3", isDashboard),
				fromUser("f1", "UserFolder1", isFolder),
			},
			expectedErr: "multiple provisioning folders exist with at least one user-created resource",
		},
		{
			name:               "single folder, some dashboards duplicated",
			provisionedFolders: []string{"folder1"},
			configDashboards:   []string{"Provisioned1", "Provisioned2", "Provisioned3", "Provisioned4"},
			provisionedResources: []dashboards.DashboardSearchProjection{
				// Provisioned1 is duplicated.
				provisioned("d1", "Provisioned1", isDashboard),
				provisioned("d2", "Provisioned2", isDashboard),
				provisioned("d3", "Provisioned1", isDashboard),
				provisioned("d4", "Provisioned3", isDashboard),
			},
			expectedSteps: []deleteProvisionedResource{
				{Type: searchstore.TypeDashboard, UID: "d1"},
				{Type: searchstore.TypeDashboard, UID: "d2"},
				{Type: searchstore.TypeDashboard, UID: "d3"},
				{Type: searchstore.TypeDashboard, UID: "d4"},
			},
		},
		{
			name:               "single folder, duplicated dashboards, user-created dashboards are ignored",
			provisionedFolders: []string{"folder1"},
			configDashboards:   []string{"Provisioned1", "Provisioned2", "Provisioned3", "Provisioned4"},
			provisionedResources: []dashboards.DashboardSearchProjection{
				// Provisioned1 is duplicated.
				provisioned("d1", "Provisioned1", isDashboard),
				provisioned("d2", "Provisioned2", isDashboard),
				fromUser("d3", "User1", isDashboard),
				provisioned("d4", "Provisioned3", isDashboard),
				provisioned("d5", "Provisioned1", isDashboard),
			},
			// User dashboard (d3) is not deleted.
			expectedSteps: []deleteProvisionedResource{
				{Type: searchstore.TypeDashboard, UID: "d1"},
				{Type: searchstore.TypeDashboard, UID: "d2"},
				{Type: searchstore.TypeDashboard, UID: "d4"},
				{Type: searchstore.TypeDashboard, UID: "d5"},
			},
		},
		{
			name:               "single folder, duplicated dashboards, user-created folders are ignored",
			provisionedFolders: []string{"folder1"},
			configDashboards:   []string{"Provisioned1", "Provisioned2", "Provisioned3"},
			provisionedResources: []dashboards.DashboardSearchProjection{
				// Provisioned1 is duplicated.
				provisioned("d1", "Provisioned1", isDashboard),
				provisioned("d2", "Provisioned2", isDashboard),
				provisioned("d3", "Provisioned3", isDashboard),
				provisioned("d4", "Provisioned1", isDashboard),
				fromUser("f1", "UserFolder1", isFolder),
			},
			// User folder (f1) is not deleted.
			expectedSteps: []deleteProvisionedResource{
				{Type: searchstore.TypeDashboard, UID: "d1"},
				{Type: searchstore.TypeDashboard, UID: "d2"},
				{Type: searchstore.TypeDashboard, UID: "d3"},
				{Type: searchstore.TypeDashboard, UID: "d4"},
			},
		},
		{
			name:               "multiple folders, only provisioned dashboards",
			provisionedFolders: []string{"folder1", "folder2"},
			configDashboards:   []string{"Provisioned1", "Provisioned2", "Provisioned3", "Provisioned4"},
			provisionedResources: []dashboards.DashboardSearchProjection{
				provisioned("d1", "Provisioned1", isDashboard),
				provisioned("d2", "Provisioned2", isDashboard),
				provisioned("d3", "Provisioned3", isDashboard),
				provisioned("d4", "Provisioned4", isDashboard),
			},
			// Delete all dashboards, then all folders.
			expectedSteps: []deleteProvisionedResource{
				{Type: searchstore.TypeDashboard, UID: "d1"},
				{Type: searchstore.TypeDashboard, UID: "d2"},
				{Type: searchstore.TypeDashboard, UID: "d3"},
				{Type: searchstore.TypeDashboard, UID: "d4"},
				{Type: searchstore.TypeFolder, UID: "folder1"},
				{Type: searchstore.TypeFolder, UID: "folder2"},
			},
		},
		{
			name:               "single folder, only deletes dashboards defined in the config file",
			provisionedFolders: []string{"folder1"},
			configDashboards:   []string{"Provisioned1", "Provisioned2"},
			provisionedResources: []dashboards.DashboardSearchProjection{
				provisioned("d1", "Provisioned1", isDashboard),
				provisioned("d2", "Provisioned2", isDashboard),
				provisioned("d3", "Provisioned1", isDashboard),
				provisioned("d4", "Provisioned4", isDashboard),
				provisioned("d5", "Provisioned4", isDashboard),
			},
			// Delete duplicated dashboards, but keep Provisioned4, since it's not in the config file.
			expectedSteps: []deleteProvisionedResource{
				{Type: searchstore.TypeDashboard, UID: "d1"},
				{Type: searchstore.TypeDashboard, UID: "d2"},
				{Type: searchstore.TypeDashboard, UID: "d3"},
			},
		},
		{
			name:               "single folder, no duplicated dashboards",
			provisionedFolders: []string{"folder1"},
			configDashboards:   []string{"Provisioned1", "Provisioned2", "Provisioned3", "Provisioned4"},
			provisionedResources: []dashboards.DashboardSearchProjection{
				provisioned("d1", "Provisioned1", isDashboard),
				provisioned("d2", "Provisioned2", isDashboard),
				provisioned("d3", "Provisioned3", isDashboard),
				provisioned("d4", "Provisioned4", isDashboard),
			},
			expectedSteps: nil, // no duplicates, nothing to do
		},
		{
			name:               "single folder, no duplicated dashboards, multiple user-created resources",
			provisionedFolders: []string{"folder1"},
			configDashboards:   []string{"Provisioned1", "Provisioned2", "Provisioned3", "Provisioned4"},
			provisionedResources: []dashboards.DashboardSearchProjection{
				provisioned("d1", "Provisioned1", isDashboard),
				provisioned("d2", "Provisioned2", isDashboard),
				fromUser("f1", "UserFolder1", isFolder),
				provisioned("d3", "Provisioned3", isDashboard),
				fromUser("d4", "User1", isDashboard),
				provisioned("d5", "Provisioned4", isDashboard),
				fromUser("d6", "User2", isDashboard),
				fromUser("f2", "UserFolder2", isFolder),
			},
			expectedSteps: nil, // no duplicates in the provisioned set, nothing to do
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			provisionedSet := make(map[string]bool)
			for _, name := range tc.configDashboards {
				provisionedSet[name] = true
			}

			steps, err := cleanupSteps(tc.provisionedFolders, tc.provisionedResources, provisionedSet)
			if tc.expectedErr == "" {
				require.NoError(t, err)
				require.Equal(t, tc.expectedSteps, steps)
			} else {
				require.Error(t, err)
				require.Equal(t, tc.expectedErr, err.Error())
			}
		})
	}
}
