package service

import (
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
)

// canBeAutomaticallyCleanedUp determines whether this instance can be automatically cleaned up
// if duplicated provisioned resources are found. To ensure the process does not delete
// resources it shouldn't, automatic cleanups only happen if all provisioned dashboards
// are stored in the same folder (by title), and no dashboards allow UI updates.
func canBeAutomaticallyCleanedUp(configs []dashboards.ProvisioningConfig) string {
	if len(configs) == 0 {
		return "no provisioned dashboards"
	}

	folderTitle := configs[0].Folder
	if len(folderTitle) == 0 {
		return fmt.Sprintf("dashboard has no folder: %s", configs[0].Name)
	}

	for _, cfg := range configs {
		if cfg.AllowUIUpdates {
			return "contains dashboards with allowUiUpdates"
		}

		if cfg.Folder != folderTitle {
			return "dashboards provisioned in different folders"
		}
	}

	return ""
}

type deleteProvisionedResource struct {
	Type string
	UID  string
}

// cleanupStep computes the sequence of steps to be performed in order to cleanup the
// provisioning resources and allow the process to start from scratch when duplication
// is detected. The sequence of steps will dictate the order in which dashboards and folders
// are to be deleted.
func cleanupSteps(provFolders []string, resources []dashboards.DashboardSearchProjection, configDashboards map[string]bool) ([]deleteProvisionedResource, error) {
	var hasDuplicatedProvisionedDashboard bool
	var hasUserCreatedResource bool
	var uniqueNames = map[string]struct{}{}
	var deleteProvisionedDashboards []deleteProvisionedResource //nolint:prealloc

	for _, r := range resources {
		// nolint:staticcheck
		if r.IsFolder || r.ManagedBy != utils.ManagerKindClassicFP {
			hasUserCreatedResource = true
			continue
		}

		// Only delete dashboards if they are included in the provisioning configuration
		// for this instance.
		if !configDashboards[r.ManagerId] {
			continue
		}

		if _, exists := uniqueNames[r.ManagerId]; exists {
			hasDuplicatedProvisionedDashboard = true
		}

		uniqueNames[r.ManagerId] = struct{}{}
		deleteProvisionedDashboards = append(deleteProvisionedDashboards, deleteProvisionedResource{
			Type: searchstore.TypeDashboard,
			UID:  r.UID,
		})
	}

	if len(provFolders) == 0 {
		// When there are no provisioned folders, there is nothing to do.
		return nil, nil
	} else if len(provFolders) == 1 {
		// If only one folder was found, keep it and delete the provisioned dashboards if
		// duplication was found.
		if hasDuplicatedProvisionedDashboard {
			return deleteProvisionedDashboards, nil
		}
	} else {
		// If multiple folders were found *and* a user-created resource exists in
		// one of them, bail, as we wouldn't be able to delete one of the duplicated folders.
		if hasUserCreatedResource {
			return nil, errors.New("multiple provisioning folders exist with at least one user-created resource")
		}

		// Delete provisioned dashboards first, and then the folders.
		steps := deleteProvisionedDashboards
		for _, uid := range provFolders {
			steps = append(steps, deleteProvisionedResource{
				Type: searchstore.TypeFolder,
				UID:  uid,
			})
		}

		return steps, nil
	}

	return nil, nil
}
