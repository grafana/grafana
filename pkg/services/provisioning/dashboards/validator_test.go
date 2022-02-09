package dashboards

import (
	"context"
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
		folderID, err := getOrCreateFolderID(context.Background(), cfg, fakeService, folderName)
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
		folderID, err := getOrCreateFolderID(context.Background(), cfg, fakeService, folderName)
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

		reader1, err := NewDashboardFileReader(cfg1, logger, nil)
		require.NoError(t, err)

		reader2, err := NewDashboardFileReader(cfg2, logger, nil)
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

		reader1, err := NewDashboardFileReader(cfg1, logger, nil)
		require.NoError(t, err)

		reader2, err := NewDashboardFileReader(cfg2, logger, nil)
		require.NoError(t, err)

		reader3, err := NewDashboardFileReader(cfg3, logger, nil)
		require.NoError(t, err)

		duplicateValidator := newDuplicateValidator(logger, []*FileReader{reader1, reader2, reader3})

		err = reader1.walkDisk(context.Background())
		require.NoError(t, err)

		err = reader2.walkDisk(context.Background())
		require.NoError(t, err)

		err = reader3.walkDisk(context.Background())
		require.NoError(t, err)

		duplicates := duplicateValidator.getDuplicates()

		folderID, err := getOrCreateFolderID(context.Background(), cfg, fakeService, cfg1.Folder)
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

		folderID, err = getOrCreateFolderID(context.Background(), cfg3, fakeService, cfg3.Folder)
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
