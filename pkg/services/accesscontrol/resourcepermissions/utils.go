package resourcepermissions

import (
	"strings"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

// ValidateActionSets errors when a actionset does not match expected pattern for plugins
// - action should be in allowlist
// - actions should have the pluginID prefix
func ValidateActionSet(pluginID string, actionset ActionSet) error {
	// takeout the pluginID prefix
	action := ""
	if strings.Contains(actionset.Action, pluginID+":") {
		action = strings.TrimPrefix(actionset.Action, pluginID+":")
	} else {
		action = strings.TrimPrefix(actionset.Action, pluginID+".")
	}
	if !isFolderOrDashboardAction(action) {
		return &accesscontrol.ErrorActionNotAllowed{Action: actionset.Action, AllowList: []string{dashboards.ScopeDashboardsRoot, dashboards.ScopeFoldersRoot}}
	}
	// verify that actions have the pluginID prefix
	// plugin.json - actionset.ActionSets - actions "k6testid:folders:edit"
	for _, action := range actionset.Actions {
		// contains two or more colons , error out
		if strings.Count(action, ":") > 1 {
			return &accesscontrol.ErrorActionPrefixMissing{Action: action,
				Prefixes: []string{pluginID + ":", pluginID + "."}}
		}
		if !strings.HasPrefix(action, pluginID+":") &&
			!strings.HasPrefix(action, pluginID+".") {
			return &accesscontrol.ErrorActionPrefixMissing{Action: action,
				Prefixes: []string{pluginID + ":", pluginID + "."}}
		}
	}

	return nil
}

func ToActionSets(pluginID, pluginName string, regs []plugins.ActionSetRegistration) []ActionSet {
	res := make([]ActionSet, 0, len(regs))
	for i := range regs {
		res = append(res, ActionSet{
			Action:  regs[i].ActionSet.Action,
			Actions: regs[i].ActionSet.Actions,
		})
	}
	return res
}
