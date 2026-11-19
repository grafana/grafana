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

// hardcodedNamespaceReadable lists the namespaced kinds that anyone allowed
// into a namespace may get and list, with no RBAC grant: storage reads them as
// the service, limited to that namespace (kindstore.Options.NamespaceReadable).
// Writes and watches still go to storage as the caller.
//
// Announcement banners are shown to every user of an instance, including those
// with no basic role, and the embedded API server serves them that way. Only
// trusted core apps may serve a core group, so no plugin can claim this one.
// TODO: this moves to the app manifest, as a declaration on the kind.
func hardcodedNamespaceReadable(group, resource string) bool {
	return group == "banners.grafana.app" && resource == "announcement-banners"
}
