package pluginroute

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
