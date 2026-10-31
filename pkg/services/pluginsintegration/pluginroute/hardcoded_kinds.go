package pluginroute

import (
	prefsapp "github.com/grafana/grafana/apps/preferences/pkg/app"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/home"
	prefsapi "github.com/grafana/grafana/pkg/registry/apis/preferences"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/setting"
)

// Everything the router knows about the kinds it authorizes by name lives in
// this file, so that replacing it with what the app manifest declares removes
// this file and nothing else.

// hardcodedKindAuth is where a kind declares that its name decides access.
// TODO: this declaration moves to the app manifest, and only ownerFromName
// and the policy fields stay here.
func hardcodedKindAuth(group, resource string) (o *ownerFromName, processMissing bool, scope listScope) {
	switch {
	case group == "collections.grafana.app" && resource == "stars":
		return &ownerFromName{
			allowOrgAdmin: true,
			owners:        []utils.ResourceOwner{utils.UserResourceOwner},
		}, true, listOwned
	case group == "preferences.grafana.app" && resource == "preferences":
		return &ownerFromName{
			names: []string{"merged"},
			owners: []utils.ResourceOwner{
				utils.NamespaceResourceOwner,
				utils.UserResourceOwner,
				utils.TeamResourceOwner,
			},
			nonUserNamespaceOnly: true,
		}, true, listOwned
	}
	return nil, false, listAll
}

// hardcodedVirtualGetter answers the fixed names of a kind authorized by name,
// where the app owns what they mean. Stars have none.
// TODO: this moves to the app manifest, with hardcodedKindAuth.
func hardcodedVirtualGetter(group, resource string, cfg *setting.Cfg) VirtualGetter {
	if group != "preferences.grafana.app" || resource != "preferences" || cfg == nil {
		return nil
	}
	return (&prefsapp.Config{
		Defaults:          prefsapi.DefaultSpec(cfg),
		HomeDashboardName: home.DASHBOARD_NAME,
		IsValidTheme:      pref.IsValidThemeID,
	}).MergedGetter()
}
