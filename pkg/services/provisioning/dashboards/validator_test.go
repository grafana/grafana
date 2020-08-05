package dashboards

import (
	"sort"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
)

const dashboardContainingUID = "testdata/test-dashboards/dashboard-with-uid"

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
		folderID, err := getOrCreateFolderID(cfg, fakeService, "duplicates-validator-folder")
		require.NoError(t, err)

		identity := dashboardIdentity{folderID: folderID, title: "Grafana"}

		cfg1 := &config{
			Name: "first", Type: "file", OrgID: 1, Folder: "duplicates-validator-folder",
			Options: map[string]interface{}{"path": dashboardContainingUID},
		}
		cfg2 := &config{
			Name: "second", Type: "file", OrgID: 1, Folder: "duplicates-validator-folder",
			Options: map[string]interface{}{"path": dashboardContainingUID},
		}

		reader1, err := NewDashboardFileReader(cfg1, logger)
		require.NoError(t, err)

		reader2, err := NewDashboardFileReader(cfg2, logger)
		require.NoError(t, err)

		duplicateValidator := newDuplicateValidator([]*FileReader{reader1, reader2})

		err = reader1.startWalkingDisk()
		require.NoError(t, err)

		err = reader2.startWalkingDisk()
		require.NoError(t, err)

		duplicates := duplicateValidator.getDuplicates()

		require.Equal(t, duplicates.UIDs["Z-phNqGmz"].Sum, uint8(2))
		uidUsageReaders := keysToSlice(duplicates.UIDs["Z-phNqGmz"].InvolvedReaders)
		sort.Strings(uidUsageReaders)
		require.Equal(t, uidUsageReaders, []string{"first", "second"})

		require.Equal(t, duplicates.Titles[identity].Sum, uint8(2))
		titleUsageReaders := keysToSlice(duplicates.Titles[identity].InvolvedReaders)
		sort.Strings(titleUsageReaders)
		require.Equal(t, titleUsageReaders, []string{"first", "second"})
	})
}
