package kinds

manifest: {
	appName:       "iam"
	groupOverride: "iam.grafana.app"
	kinds: [ globalrole, globalrolebinding, corerole, role, rolebinding, resourcepermission ]
}
