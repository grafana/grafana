package dashboards

import (
	"sort"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
)

const (
	dashboardContainingUID = "testdata/test-dashboards/dashboard-with-uid"
	twoDashboardsWithUID   = "testdata/test-dashboards/two-dashboards-with-uid"
)

func TestDuplicatesValidator(t *testing.T) {
	bus.ClearBusHandlers()
	fakeService = mockDashboardProvisioningService()

	bus.AddHandler("test", mockGetDashboardQuery)
	cfg := &config{
		Name:    "Default",
		Type:    "file",
		OrgID:   1,
		Folder:  "",
		Options: map[string]interface{}{},
	}
	logger := log.New("test.logger")

	t.Run("Duplicates validator should collect info about duplicate UIDs and titles within folders", func(t *testing.T) {
		const folderName = "duplicates-validator-folder"
		folderID, err := getOrCreateFolderID(cfg, fakeService, folderName)
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

		reader1, err := NewDashboardFileReader(cfg1, logger, nil)
		require.NoError(t, err)

		reader2, err := NewDashboardFileReader(cfg2, logger, nil)
		require.NoError(t, err)

		duplicateValidator := newDuplicateValidator(logger, []*FileReader{reader1, reader2})

		err = reader1.walkDisk()
		require.NoError(t, err)

		err = reader2.walkDisk()
		require.NoError(t, err)

		duplicates := duplicateValidator.getDuplicates()

		require.Equal(t, uint8(2), duplicates.UIDs["Z-phNqGmz"].Sum)
		uidUsageReaders := keysToSlice(duplicates.UIDs["Z-phNqGmz"].InvolvedReaders)
		sort.Strings(uidUsageReaders)
		require.Equal(t, []string{"first", "second"}, uidUsageReaders)

		require.Equal(t, uint8(2), duplicates.Titles[identity].Sum)
		titleUsageReaders := keysToSlice(duplicates.Titles[identity].InvolvedReaders)
		sort.Strings(titleUsageReaders)
		require.Equal(t, []string{"first", "second"}, titleUsageReaders)

		duplicateValidator.validate()
		require.True(t, reader1.isDatabaseAccessRestricted())
		require.True(t, reader2.isDatabaseAccessRestricted())
	})

	t.Run("Duplicates validator should restrict write access only for readers with duplicates", func(t *testing.T) {
		cfg1 := &config{
			Name: "first", Type: "file", OrgID: 1, Folder: "duplicates-validator-folder",
			Options: map[string]interface{}{"path": twoDashboardsWithUID},
		}
		cfg2 := &config{
			Name: "second", Type: "file", OrgID: 1, Folder: "root",
			Options: map[string]interface{}{"path": defaultDashboards},
		}

		reader1, err := NewDashboardFileReader(cfg1, logger, nil)
		require.NoError(t, err)

		reader2, err := NewDashboardFileReader(cfg2, logger, nil)
		require.NoError(t, err)

		duplicateValidator := newDuplicateValidator(logger, []*FileReader{reader1, reader2})

		err = reader1.walkDisk()
		require.NoError(t, err)

		err = reader2.walkDisk()
		require.NoError(t, err)

		duplicates := duplicateValidator.getDuplicates()

		folderID, err := getOrCreateFolderID(cfg, fakeService, cfg1.Folder)
		require.NoError(t, err)

		identity := dashboardIdentity{folderID: folderID, title: "Grafana"}

		require.Equal(t, uint8(2), duplicates.UIDs["Z-phNqGmz"].Sum)
		uidUsageReaders := keysToSlice(duplicates.UIDs["Z-phNqGmz"].InvolvedReaders)
		sort.Strings(uidUsageReaders)
		require.Equal(t, []string{"first"}, uidUsageReaders)

		require.Equal(t, uint8(2), duplicates.Titles[identity].Sum)
		titleUsageReaders := keysToSlice(duplicates.Titles[identity].InvolvedReaders)
		sort.Strings(titleUsageReaders)
		require.Equal(t, []string{"first"}, titleUsageReaders)

		duplicateValidator.validate()
		require.True(t, reader1.isDatabaseAccessRestricted())
		require.False(t, reader2.isDatabaseAccessRestricted())
	})
}
