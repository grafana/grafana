package preferences

manifest: {
	appName:          "preferences"
	groupOverride:    "preferences.grafana.app"
	preferredVersion: "v1"
	versions: {
		"v1": {
			storage: true
			codegen: {
				ts: {enabled: false}
				go: {enabled: true} // v1 is the generated version
			}
			kinds: [
				preferencesV1,
			]
			routes: namespaced: _mergedRoutes
		}
		"v1alpha1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: false} // v1alpha1 is now a thin wrapper around v1
			}
			kinds: [
				preferencesV1alpha1,
			]
			routes: namespaced: _mergedRoutesAlpha
		}
	}
	// preferences/merged is a fixed name of the kind: no object is stored under it.
	_mergedRoute: {
		operationId:        "mergedPreferences"
		description:        "Get preferences for requester.  This combines the user preferences with the team and global defaults"
		allowMissingParent: true
	}
	_mergedRoutes: "/preferences/merged": GET: _mergedRoute & {responseKind: "Preferences"}
	// v1alpha1 generates no kind Go code, so it has no kind to return. The response is the same object.
	_mergedRoutesAlpha: "/preferences/merged": GET: _mergedRoute & {response: {}}
	// preferences/merged lists the caller's preferences. An anonymous caller has no
	// identity to list as, so the app lists as itself, and sees what any identity
	// that is not a user sees: the namespace's preferences.
	extraPermissions: {
		accessKinds: [
			{
				group:    "preferences.grafana.app"
				resource: "preferences"
				actions: ["get"]
			},
		]
	}
	roles: {}
}
