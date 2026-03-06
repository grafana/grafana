package kinds

manifest: {
	// appName is the unique name of your app. It is used to reference the app from other config objects,
	// and to generate the group used by your app in the app platform API.
	appName: "theme"
	// groupOverride can be used to specify a non-appName-based API group.
	// By default, an app's API group is LOWER(REPLACE(appName, '-', '')).ext.grafana.com,
	// but there are cases where this needs to be changed.
	// Keep in mind that changing this after an app is deployed can cause problems with clients and/or kind data.
	groupOverride: "theme.grafana.app"

	// versions is a map of versions supported by your app. Version names should follow the format "v<integer>" or
	// "v<integer>(alpha|beta)<integer>". Each version contains the kinds your app manages for that version.
	// If your app needs access to kinds managed by another app, use permissions.accessKinds to allow your app access.
	versions: {
        "v0alpha1": v0alpha1
	}
}

v0alpha1: {
    kinds: [themeV0alpha1]
}
