package kinds

manifest: {
	appName:       "authz"
	groupOverride: "authz.grafana.app"
	kinds: [ clusterrole, clusterrolebinding, corerole, role, rolebinding, managedpermission ]
}
