package dashboards

import (
	"context"
	"sort"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

const (
	dashboardContainingUID = "testdata/test-dashboards/dashboard-with-uid"
	twoDashboardsWithUID   = "testdata/test-dashboards/two-dashboards-with-uid"
)

func TestDuplicatesValidator(t *testing.T) {
	fakeService := &dashboards.FakeDashboardProvisioning{}
	defer fakeService.AssertExpectations(t)

	cfg := &config{
		Name:    "Default",
		Type:    "file",
		OrgID:   1,
		Folder:  "",
		Options: map[string]interface{}{"path": dashboardContainingUID},
	}
	logger := log.New("test.logger")

	t.Run("Duplicates validator should collect info about duplicate UIDs and titles within folders", func(t *testing.T) {
		const folderName = "duplicates-validator-folder"

		fakeStore := &fakeDashboardStore{}
		r, err := NewDashboardFileReader(cfg, logger, nil, fakeStore)
		require.NoError(t, err)
		fakeService.On("SaveFolderForProvisionedDashboards", mock.Anything, mock.Anything).Return(&dashboards.Dashboard{}, nil).Times(6)
		fakeService.On("GetProvisionedDashboardData", mock.Anything, mock.AnythingOfType("string")).Return([]*dashboards.DashboardProvisioning{}, nil).Times(4)
		fakeService.On("SaveProvisionedDashboard", mock.Anything, mock.Anything, mock.Anything).Return(&dashboards.Dashboard{}, nil).Times(5)
		folderID, err := r.getOrCreateFolderID(context.Background(), cfg, fakeService, folderName)
		require.NoError(t, err)

		identity := dashboardIdentity{folderID: folderID, title: "Grafana"}

		cfg1 := &config{
			Name: "first", Type: "file", OrgID: 1, Folder: folderName,
			Options: map[string]interface{}{"path": dashboardContainingUID},
		}
		cfg2 := &config{
			Name: "second", Type: "file", OrgID: 1, Folder: folderName,
			Options: map[string]interface{}{"path": dashboardContainingUID},
		}

		reader1, err := NewDashboardFileReader(cfg1, logger, nil, fakeStore)
		reader1.dashboardProvisioningService = fakeService
		require.NoError(t, err)

		reader2, err := NewDashboardFileReader(cfg2, logger, nil, fakeStore)
		reader2.dashboardProvisioningService = fakeService
		require.NoError(t, err)

		duplicateValidator := newDuplicateValidator(logger, []*FileReader{reader1, reader2})

		err = reader1.walkDisk(context.Background())
		require.NoError(t, err)

		err = reader2.walkDisk(context.Background())
		require.NoError(t, err)

		duplicates := duplicateValidator.getDuplicates()

		require.Equal(t, uint8(2), duplicates[1].UIDs["Z-phNqGmz"].Sum)
		uidUsageReaders := keysToSlice(duplicates[1].UIDs["Z-phNqGmz"].InvolvedReaders)
		sort.Strings(uidUsageReaders)
		require.Equal(t, []string{"first", "second"}, uidUsageReaders)

		require.Equal(t, uint8(2), duplicates[1].Titles[identity].Sum)
		titleUsageReaders := keysToSlice(duplicates[1].Titles[identity].InvolvedReaders)
		sort.Strings(titleUsageReaders)
		require.Equal(t, []string{"first", "second"}, titleUsageReaders)

		duplicateValidator.validate()
		require.True(t, reader1.isDatabaseAccessRestricted())
		require.True(t, reader2.isDatabaseAccessRestricted())
	})

	t.Run("Duplicates validator should not collect info about duplicate UIDs and titles within folders for different orgs", func(t *testing.T) {
		const folderName = "duplicates-validator-folder"

		fakeStore := &fakeDashboardStore{}
		r, err := NewDashboardFileReader(cfg, logger, nil, fakeStore)
		require.NoError(t, err)
		folderID, err := r.getOrCreateFolderID(context.Background(), cfg, fakeService, folderName)
		require.NoError(t, err)

		identity := dashboardIdentity{folderID: folderID, title: "Grafana"}

		cfg1 := &config{
			Name: "first", Type: "file", OrgID: 1, Folder: folderName,
			Options: map[string]interface{}{"path": dashboardContainingUID},
		}
		cfg2 := &config{
			Name: "second", Type: "file", OrgID: 2, Folder: folderName,
			Options: map[string]interface{}{"path": dashboardContainingUID},
		}

		reader1, err := NewDashboardFileReader(cfg1, logger, nil, fakeStore)
		reader1.dashboardProvisioningService = fakeService
		require.NoError(t, err)

		reader2, err := NewDashboardFileReader(cfg2, logger, nil, fakeStore)
		reader2.dashboardProvisioningService = fakeService
		require.NoError(t, err)

		duplicateValidator := newDuplicateValidator(logger, []*FileReader{reader1, reader2})

		err = reader1.walkDisk(context.Background())
		require.NoError(t, err)

		err = reader2.walkDisk(context.Background())
		require.NoError(t, err)

		duplicates := duplicateValidator.getDuplicates()

		require.Equal(t, uint8(1), duplicates[1].UIDs["Z-phNqGmz"].Sum)
		uidUsageReaders := keysToSlice(duplicates[1].UIDs["Z-phNqGmz"].InvolvedReaders)
		sort.Strings(uidUsageReaders)
		require.Equal(t, []string{"first"}, uidUsageReaders)

		require.Equal(t, uint8(1), duplicates[2].UIDs["Z-phNqGmz"].Sum)
		uidUsageReaders = keysToSlice(duplicates[2].UIDs["Z-phNqGmz"].InvolvedReaders)
		sort.Strings(uidUsageReaders)
		require.Equal(t, []string{"second"}, uidUsageReaders)

		require.Equal(t, uint8(1), duplicates[1].Titles[identity].Sum)
		titleUsageReaders := keysToSlice(duplicates[1].Titles[identity].InvolvedReaders)
		sort.Strings(titleUsageReaders)
		require.Equal(t, []string{"first"}, titleUsageReaders)

		require.Equal(t, uint8(1), duplicates[2].Titles[identity].Sum)
		titleUsageReaders = keysToSlice(duplicates[2].Titles[identity].InvolvedReaders)
		sort.Strings(titleUsageReaders)
		require.Equal(t, []string{"second"}, titleUsageReaders)

		duplicateValidator.validate()
		require.False(t, reader1.isDatabaseAccessRestricted())
		require.False(t, reader2.isDatabaseAccessRestricted())
	})

	t.Run("Duplicates validator should restrict write access only for readers with duplicates", func(t *testing.T) {
		fakeService.On("SaveFolderForProvisionedDashboards", mock.Anything, mock.Anything).Return(&dashboards.Dashboard{}, nil).Times(5)
		fakeService.On("GetProvisionedDashboardData", mock.Anything, mock.AnythingOfType("string")).Return([]*dashboards.DashboardProvisioning{}, nil).Times(3)
		fakeService.On("SaveProvisionedDashboard", mock.Anything, mock.Anything, mock.Anything).Return(&dashboards.Dashboard{}, nil).Times(5)
		fakeStore := &fakeDashboardStore{}

		cfg1 := &config{
			Name: "first", Type: "file", OrgID: 1, Folder: "duplicates-validator-folder",
			Options: map[string]interface{}{"path": twoDashboardsWithUID},
		}
		cfg2 := &config{
			Name: "second", Type: "file", OrgID: 1, Folder: "root",
			Options: map[string]interface{}{"path": defaultDashboards},
		}
		cfg3 := &config{
			Name: "third", Type: "file", OrgID: 2, Folder: "duplicates-validator-folder",
			Options: map[string]interface{}{"path": twoDashboardsWithUID},
		}
		reader1, err := NewDashboardFileReader(cfg1, logger, nil, fakeStore)
		reader1.dashboardProvisioningService = fakeService
		require.NoError(t, err)

		reader2, err := NewDashboardFileReader(cfg2, logger, nil, fakeStore)
		reader2.dashboardProvisioningService = fakeService
		require.NoError(t, err)

		reader3, err := NewDashboardFileReader(cfg3, logger, nil, fakeStore)
		reader3.dashboardProvisioningService = fakeService
		require.NoError(t, err)

		duplicateValidator := newDuplicateValidator(logger, []*FileReader{reader1, reader2, reader3})

		err = reader1.walkDisk(context.Background())
		require.NoError(t, err)

		err = reader2.walkDisk(context.Background())
		require.NoError(t, err)

		err = reader3.walkDisk(context.Background())
		require.NoError(t, err)

		duplicates := duplicateValidator.getDuplicates()

		r, err := NewDashboardFileReader(cfg, logger, nil, fakeStore)
		require.NoError(t, err)
		folderID, err := r.getOrCreateFolderID(context.Background(), cfg, fakeService, cfg1.Folder)
		require.NoError(t, err)

		identity := dashboardIdentity{folderID: folderID, title: "Grafana"}

		require.Equal(t, uint8(2), duplicates[1].UIDs["Z-phNqGmz"].Sum)
		uidUsageReaders := keysToSlice(duplicates[1].UIDs["Z-phNqGmz"].InvolvedReaders)
		sort.Strings(uidUsageReaders)
		require.Equal(t, []string{"first"}, uidUsageReaders)

		require.Equal(t, uint8(2), duplicates[1].Titles[identity].Sum)
		titleUsageReaders := keysToSlice(duplicates[1].Titles[identity].InvolvedReaders)
		sort.Strings(titleUsageReaders)
		require.Equal(t, []string{"first"}, titleUsageReaders)

		r, err = NewDashboardFileReader(cfg3, logger, nil, fakeStore)
		require.NoError(t, err)
		folderID, err = r.getOrCreateFolderID(context.Background(), cfg3, fakeService, cfg3.Folder)
		require.NoError(t, err)

		identity = dashboardIdentity{folderID: folderID, title: "Grafana"}

		require.Equal(t, uint8(2), duplicates[2].UIDs["Z-phNqGmz"].Sum)
		uidUsageReaders = keysToSlice(duplicates[2].UIDs["Z-phNqGmz"].InvolvedReaders)
		sort.Strings(uidUsageReaders)
		require.Equal(t, []string{"third"}, uidUsageReaders)

		require.Equal(t, uint8(2), duplicates[2].Titles[identity].Sum)
		titleUsageReaders = keysToSlice(duplicates[2].Titles[identity].InvolvedReaders)
		sort.Strings(titleUsageReaders)
		require.Equal(t, []string{"third"}, titleUsageReaders)

		duplicateValidator.validate()
		require.True(t, reader1.isDatabaseAccessRestricted())
		require.False(t, reader2.isDatabaseAccessRestricted())
		require.True(t, reader3.isDatabaseAccessRestricted())
	})
}
