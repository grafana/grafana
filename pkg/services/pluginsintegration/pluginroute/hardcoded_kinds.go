package pluginroute

import (
	"github.com/grafana/grafana-app-sdk/resource"
	prefsapp "github.com/grafana/grafana/apps/preferences/pkg/app"
)

// Everything the router knows about the kinds it authorizes by name lives in
// this file, so that replacing it with what the app manifest declares removes
// this file and nothing else.

// hardcodedKindAuth is where a kind declares that its name decides access.
// TODO: this declaration moves to the app manifest, and only ownerFromName
// and the policy fields stay here.
func hardcodedKindAuth(group, name string) (o *ownerFromName, allowMissingParent bool) {
	switch {
	case group == "collections.grafana.app" && name == "stars":
		return &ownerFromName{
			allowOrgAdmin: true,
			owners:        []resource.Owner{resource.UserResourceOwner},
		}, true
	case group == "preferences.grafana.app" && name == "preferences":
		return &ownerFromName{
			names: []string{"merged"},
			owners: []resource.Owner{
				resource.NamespaceResourceOwner,
				resource.UserResourceOwner,
				resource.TeamResourceOwner,
			},
			nonUserNamespaceOnly: true,
		}, true
	}
	return nil, false
}

// hardcodedVirtualGetter answers the fixed names of a kind authorized by name,
// where the app owns what they mean. Stars have none.
//
// TEMPORARY: this, Options.PreferencesConfig and the router's CoreApp field
// that feeds it exist only because the getter is hardcoded here. They go away
// when the app manifest declares the name and the router asks the app for it.
func hardcodedVirtualGetter(group, resource string, preferences *prefsapp.Config) VirtualGetter {
	if group != "preferences.grafana.app" || resource != "preferences" || preferences == nil {
		return nil
	}
	return preferences.MergedGetter()
}
