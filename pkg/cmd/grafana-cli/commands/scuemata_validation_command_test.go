package commands

import (
	"github.com/grafana/grafana/pkg/schema/load"
	"github.com/stretchr/testify/require"
	"testing"
)

var baseLoadPaths = load.GetDefaultLoadPaths()

func TestValidateScuemataBasics(t *testing.T) {
	err := validate(baseLoadPaths, load.BaseDashboardFamily)
	require.NoError(t, err, "error while loading base dashboard scuemata")

	err = validate(baseLoadPaths, load.DistDashboardFamily)
	require.NoError(t, err, "error while loading dist dashboard scuemata")
}
