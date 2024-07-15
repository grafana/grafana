package resourcepermissions

import (
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/pluginutils"
)

// ValidateActionSets errors when a actionset does not match expected pattern for plugins
// - action set should exist and should be dashboard or folder action set
// - actions should have the pluginID prefix
func (s *InMemoryActionSets) validateActionSet(pluginID string, actionSet plugins.ActionSet) error {
	if !isFolderOrDashboardAction(actionSet.Action) {
		return accesscontrol.ErrActionSetValidationFailed.Errorf("currently only dashboard and folder action sets are supported")
	}

	// TODO also test that failures get printed nicely
	if !isFolderOrDashboardAction(actionSet.Action) {
		return accesscontrol.ErrActionSetValidationFailed.Errorf("currently only folder and dashboard action sets are supported, provided action set %s is not a folder or dashboard action set", actionSet.Action)
	}

	// verify that actions have the pluginID prefix, plugins are only allowed to register actions for the plugin
	for _, action := range actionSet.Actions {
		if err := pluginutils.ValidatePluginAction(pluginID, action); err != nil {
			return err
		}
	}

	return nil
}
