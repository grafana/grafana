package load

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"cuelang.org/go/cue"
	"github.com/grafana/grafana/pkg/schema"
	"github.com/stretchr/testify/require"
)

func TestLoadBaseDashboard(t *testing.T) {
	currentpath, _ := os.Getwd()
	loadpaths := &BaseLoadPaths{
		BaseCueFS:       currentpath,
		DistPluginCueFS: currentpath,
		InstanceCueFS:   currentpath,
	}

	t.Run("Test lookup dashboardFamily with success", func(t *testing.T) {
		mockBuildDashboardFamily()
		t.Cleanup(resetBuildDashboardFamily)
		loadpaths.packageName = "grafanaschematest1"
		_, err := BaseDashboard(*loadpaths)
		require.EqualError(t, err, "dashboardFamily found but build go object failed")
	})

	t.Run("Test dashboardFamily object should exist in cue definition", func(t *testing.T) {
		loadpaths.packageName = "grafanaschematest2"
		_, err := BaseDashboard(*loadpaths)
		if !strings.Contains(err.Error(), `reference "dashboardFamily" not found`) {
			t.Error("test failed, when dashboardFamily field missing, expect load cue defnition fails, got succeed")
		}
	})

	t.Run("Test dashboardFamily object should contain at least 1 major version", func(t *testing.T) {
		loadpaths.packageName = "grafanaschematest3"
		_, err := BaseDashboard(*loadpaths)
		require.NoError(t, err)
	})

}

func mockBuildDashboardFamily() {
	buildFamilyFunc = func(fam *schema.Family, famval cue.Value) (*schema.Family, error) {
		return fam, fmt.Errorf("dashboardFamily found but build go object failed")
	}
}

func resetBuildDashboardFamily() {
	buildFamilyFunc = BuildDashboardFamily
}

func TestLoadDistPanels(t *testing.T) {
	currentpath, _ := os.Getwd()
	p := BaseLoadPaths{
		BaseCueFS:       filepath.Join(currentpath, "../../../cue"),
		DistPluginCueFS: filepath.Join(currentpath, "../../../public/app/plugins"),
	}

	t.Run("Test run it", func(t *testing.T) {
		_, err := DistPanels(p)
		require.NoError(t, err)
		t.Fail()
	})
}
