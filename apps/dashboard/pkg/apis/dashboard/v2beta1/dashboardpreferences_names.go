package v2beta1

// The metadata.name of a DashboardPreferences object is derived from its tier. The helpers live in
// the API package so that the folder, IAM and dashboard preferences service packages can build
// names without importing the dashboard registry.

// DashboardPreferencesOrgName is the name of the org tier object.
const DashboardPreferencesOrgName = "namespace"

// DashboardPreferencesFolderName is the name of the folder tier object for the folder with the given UID.
// folderUID must not be a root folder UID ("" or "general"): root-level preferences live in the org tier object, DashboardPreferencesOrgName.
func DashboardPreferencesFolderName(folderUID string) string {
	return "folder-" + folderUID
}

// DashboardPreferencesUserName is the name of the user tier object for the user with the given UID.
func DashboardPreferencesUserName(userUID string) string {
	return "user-" + userUID
}
