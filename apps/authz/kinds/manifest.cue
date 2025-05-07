package kinds

manifest: {
	appName:       "authz"
	groupOverride: "authz.grafana.app"
	kinds: [ role, rolebinding, managedpermission ]
}
