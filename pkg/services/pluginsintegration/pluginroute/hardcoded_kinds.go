package pluginroute

import (
	"strings"

	"github.com/grafana/grafana-app-sdk/resource"
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

// hardcodedOwnerFromName is a naming strategy the app manifest cannot declare
// yet: user storage objects are named <service>:<user_uid>, so a user owns one
// object per service. The names a user owns cannot be listed from the user, so
// users may not list or watch; Grafana server admins may do anything.
// TODO: this moves to the app manifest, as a naming strategy.
func hardcodedOwnerFromName(group, kindResource string) *ownerFromName {
	if group != "userstorage.grafana.app" || kindResource != "user-storage" {
		return nil
	}
	return &ownerFromName{
		owners:            []resource.Owner{resource.UserResourceOwner},
		ownerOfName:       parseServiceUserName,
		allowGrafanaAdmin: true,
		readScope:         readNone,
	}
}

// parseServiceUserName reads the user from a <service>:<user_uid> name: one
// object per user for each service, as user storage and Logs Drilldown name
// them.
func parseServiceUserName(name string) (resource.OwnerReference, bool) {
	parts := strings.Split(name, ":")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return resource.OwnerReference{}, false
	}
	return resource.UserOwner(parts[1]), true
}
