package pluginroute

import (
	prefsapp "github.com/grafana/grafana/apps/preferences/pkg/app"
)

// What the router still knows about the kinds it authorizes by name, because
// the app manifest cannot declare it yet, lives in this file. The rest (owners,
// org admin access, fixed names) comes from the kind's naming strategy.

// hardcodedNonUserNamespaceOnly is the part of authorizing by name the app
// manifest cannot declare yet: an identity that is not a user (an access
// policy, the image renderer) lists only the namespace's preferences.
// TODO: this moves to the app manifest, with the naming strategy.
func hardcodedNonUserNamespaceOnly(group, resource string) bool {
	return group == "preferences.grafana.app" && resource == "preferences"
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
