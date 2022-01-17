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
	testDashboardUID       = "Z-phNqGmz"
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

		uidIdt := uidIdentity{orgId: 1, uid: testDashboardUID}
		titleIdt := titleIdentity{orgId: 1, folderID: folderID, title: "Grafana"}

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

		require.Equal(t, uint8(2), duplicates.UIDs[uidIdt].Sum)
		uidUsageReaders := keysToSlice(duplicates.UIDs[uidIdt].InvolvedReaders)
		sort.Strings(uidUsageReaders)
		require.Equal(t, []string{"first", "second"}, uidUsageReaders)

		require.Equal(t, uint8(2), duplicates.Titles[titleIdt].Sum)
		titleUsageReaders := keysToSlice(duplicates.Titles[titleIdt].InvolvedReaders)
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

		err = reader1.walkDisk(context.Background())
		require.NoError(t, err)

		err = reader2.walkDisk(context.Background())
		require.NoError(t, err)

		duplicates := duplicateValidator.getDuplicates()

		folderID, err := getOrCreateFolderID(context.Background(), cfg, fakeService, cfg1.Folder)
		require.NoError(t, err)

		uidIdt := uidIdentity{orgId: 1, uid: testDashboardUID}
		titleIdt := titleIdentity{orgId: 1, folderID: folderID, title: "Grafana"}

		require.Equal(t, uint8(2), duplicates.UIDs[uidIdt].Sum)
		uidUsageReaders := keysToSlice(duplicates.UIDs[uidIdt].InvolvedReaders)
		sort.Strings(uidUsageReaders)
		require.Equal(t, []string{"first"}, uidUsageReaders)

		require.Equal(t, uint8(2), duplicates.Titles[titleIdt].Sum)
		titleUsageReaders := keysToSlice(duplicates.Titles[titleIdt].InvolvedReaders)
		sort.Strings(titleUsageReaders)
		require.Equal(t, []string{"first"}, titleUsageReaders)

		duplicateValidator.validate()
		require.True(t, reader1.isDatabaseAccessRestricted())
		require.False(t, reader2.isDatabaseAccessRestricted())
	})

	t.Run("Duplicates validator should not restrict write access for duplicate UIDs and titles for different OrgID", func(t *testing.T) {
		const folderName = "duplicates-validator-folder"

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

		folderID, err := getOrCreateFolderID(context.Background(), cfg, fakeService, folderName)
		require.NoError(t, err)

		duplicates := duplicateValidator.getDuplicates()

		uidIdt1 := uidIdentity{orgId: 1, uid: testDashboardUID}
		uidIdt2 := uidIdentity{orgId: 2, uid: testDashboardUID}
		titleIdt1 := titleIdentity{orgId: 1, folderID: folderID, title: "Grafana"}
		titleIdt2 := titleIdentity{orgId: 2, folderID: folderID, title: "Grafana"}

		require.Equal(t, uint8(1), duplicates.UIDs[uidIdt1].Sum)
		uidUsageReaders1 := keysToSlice(duplicates.UIDs[uidIdt1].InvolvedReaders)
		sort.Strings(uidUsageReaders1)
		require.Equal(t, []string{"first"}, uidUsageReaders1)

		require.Equal(t, uint8(1), duplicates.UIDs[uidIdt2].Sum)
		uidUsageReaders2 := keysToSlice(duplicates.UIDs[uidIdt2].InvolvedReaders)
		sort.Strings(uidUsageReaders2)
		require.Equal(t, []string{"second"}, uidUsageReaders2)

		require.Equal(t, uint8(1), duplicates.Titles[titleIdt1].Sum)
		titleUsageReaders1 := keysToSlice(duplicates.Titles[titleIdt1].InvolvedReaders)
		sort.Strings(titleUsageReaders1)
		require.Equal(t, []string{"first"}, titleUsageReaders1)

		require.Equal(t, uint8(1), duplicates.Titles[titleIdt2].Sum)
		titleUsageReaders2 := keysToSlice(duplicates.Titles[titleIdt2].InvolvedReaders)
		sort.Strings(titleUsageReaders2)
		require.Equal(t, []string{"second"}, titleUsageReaders2)

		duplicateValidator.validate()
		require.False(t, reader1.isDatabaseAccessRestricted())
		require.False(t, reader2.isDatabaseAccessRestricted())
	})
}
