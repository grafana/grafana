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
	// if actionset action does not have the pluginID prefix return err
	if !strings.HasPrefix(actionset.Action, pluginID+":") &&
		!strings.HasPrefix(actionset.Action, pluginID+".") {
		return &accesscontrol.ErrorActionPrefixMissing{Action: actionset.Action,
			Prefixes: []string{pluginID + ":", pluginID + "."}}
	}
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
