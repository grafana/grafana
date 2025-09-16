package kinds

manifest: {
	// appName is the unique name of your app. It is used to reference the app from other config objects,
	// and to generate the group used by your app in the app platform API.
	appName: "shorturl"
	groupOverride: "shorturl.grafana.app"
	// groupOverride can be used to specify a non-appName-based API group.
	// By default, an app's API group is LOWER(REPLACE(appName, '-', '')).ext.grafana.com,
	// but there are cases where this needs to be changed.
	// Keep in mind that changing this after an app is deployed can cause problems with clients and/or kind data.
	// groupOverride: foo.ext.grafana.app

	// versions is a map of versions supported by your app. Version names should follow the format "v<integer>" or
	// "v<integer>(alpha|beta)<integer>". Each version contains the kinds your app manages for that version.
	// If your app needs access to kinds managed by another app, use permissions.accessKinds to allow your app access.
	versions: {
	    "v1alpha1": v1alpha1
	}
	// extraPermissions contains any additional permissions your app may require to function.
	// Your app will always have all permissions for each kind it manages (the items defined in 'kinds').
	extraPermissions: {
		// If your app needs access to additional kinds supplied by other apps, you can list them here
		accessKinds: [
			// Here is an example for your app accessing the playlist kind for reads and watch
			// {
			//	group: "playlist.grafana.app"
			//	resource: "playlists"
			//	actions: ["get","list","watch"]
			// }
		]
	}
}

// v1alpha1 is the v1alpha1 version of the app's API.
// It includes kinds which the v1alpha1 API serves, and (future) custom routes served globally from the v1alpha1 version.
v1alpha1: {
    // kinds is the list of kinds served by this version
    kinds: [shorturl]
    // [OPTIONAL]
    // served indicates whether this particular version is served by the API server.
    // served should be set to false before a version is removed from the manifest entirely.
    // served defaults to true if not present.
    served: true
    // [OPTIONAL]
    // Codegen is a trait that tells the grafana-app-sdk, or other code generation tooling, how to process this kind.
    // If not present, default values within the codegen trait are used.
    // If you wish to specify codegen per-version, put this section in the version's object
    // (for example, <no value>v1alpha1) instead.
    codegen: {
        // [OPTIONAL]
        // ts contains TypeScript code generation properties for the kind
        ts: {
            // [OPTIONAL]
            // enabled indicates whether the CLI should generate front-end TypeScript code for the kind.
            // Defaults to true if not present.
            enabled: true
        }
        // [OPTIONAL]
        // go contains go code generation properties for the kind
        go: {
            // [OPTIONAL]
            // enabled indicates whether the CLI should generate back-end go code for the kind.
            // Defaults to true if not present.
            enabled: true
        }
    }
}
