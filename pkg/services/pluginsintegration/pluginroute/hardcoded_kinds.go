package pluginroute

import (
	"strings"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
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

// hardcodedUserStorage is the kind whose objects are named <service>:<user_uid>.
// The name is the access control: a user reaches only their own objects.
// TODO: this moves to the app manifest, as a naming strategy.
func hardcodedUserStorage(group, resource string) bool {
	return group == "userstorage.grafana.app" && resource == "user-storage"
}

// authorizeUserStorage decides a request on a hardcodedUserStorage kind.
func authorizeUserStorage(user identity.Requester, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	if user.GetIsGrafanaAdmin() {
		return authorizer.DecisionAllow, "", nil
	}
	switch attr.GetVerb() {
	case "create":
		// The name is in the body, so the app checks it on admission.
		return authorizer.DecisionAllow, "", nil
	case "get", "delete", "patch", "update":
		if userStorageNameMatchesUser(attr.GetName(), user) {
			return authorizer.DecisionAllow, "", nil
		}
	}
	return authorizer.DecisionDeny, "forbidden", nil
}

func userStorageNameMatchesUser(name string, user identity.Requester) bool {
	parts := strings.Split(name, ":")
	if len(parts) != 2 {
		return false
	}
	// The identity UID is <type>:<uid>
	uid := strings.Split(user.GetUID(), ":")
	return len(uid) == 2 && parts[1] == uid[1]
}
