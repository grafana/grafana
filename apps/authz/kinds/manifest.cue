package kinds

manifest: {
	appName:       "authz"
	groupOverride: "authz.grafana.app"
	kinds: [ globalrole, globalrolebinding, corerole, role, rolebinding, resourcepermission ]
}
