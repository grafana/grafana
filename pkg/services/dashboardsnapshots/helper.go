package dashboardsnapshots

import (
	"fmt"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

// PrepareLocalSnapshot prepares the command for a local snapshot and returns the snapshot URL.
func PrepareLocalSnapshot(cmd *CreateDashboardSnapshotCommand, originalDashboardURL string) (string, error) {
	cmd.Dashboard.SetNestedField(originalDashboardURL, "snapshot", "originalUrl")

	if cmd.Name == "" {
		cmd.Name = "Unnamed snapshot"
	}

	if cmd.Key == "" {
		key, err := util.GetRandomString(32)
		if err != nil {
			return "", err
		}
		cmd.Key = key
	}

	if cmd.DeleteKey == "" {
		deleteKey, err := util.GetRandomString(32)
		if err != nil {
			return "", err
		}
		cmd.DeleteKey = deleteKey
	}

	return setting.ToAbsUrl("dashboard/snapshot/" + cmd.Key), nil
}

func CreateOriginalDashboardURL(cmd *CreateDashboardSnapshotCommand) (string, error) {
	dashUID := cmd.Dashboard.GetNestedString("uid")
	if ok := util.IsValidShortUID(dashUID); !ok {
		return "", fmt.Errorf("invalid dashboard UID")
	}

	return fmt.Sprintf("/d/%v", dashUID), nil
}
