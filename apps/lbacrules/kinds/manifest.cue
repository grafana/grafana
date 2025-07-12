package kinds

manifest: {
	// appName is the unique name of your app. It is used to reference the app from other config objects,
	// and to generate the group used by your app in the app platform API.
	appName: "lbacrule"
	groupOverride: "lbacrule.grafana.app"
	// kinds is the list of kinds that your app defines and manages. If your app deals with kinds defined/managed
	// by another app, use permissions.accessKinds to allow your app access
	kinds: [ lbacrule ]
}