package kinds

manifest: {
	// appName is the unique name of your app. It is used to reference the app from other config objects,
	// and to generate the group used by your app in the app platform API.
	appName: "playlist"
	// kinds is the list of kinds that your app defines and manages. If your app deals with kinds defined/managed
	// by another app, use permissions.accessKinds to allow your app access
	kinds: [playlist]
	// extraPermissions contains any additional permissions your app may require to function.
	// Your app will always have all permissions for each kind it manages (the items defined in 'kinds').
  groupOverride: "playlist.grafana.app"
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
