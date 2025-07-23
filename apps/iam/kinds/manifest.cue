package kinds

manifest: {
	appName:       "iam"
	groupOverride: "iam.grafana.app"
	preferredVersion: "v0alpha1"
	kinds: [
		globalrole, 
		globalrolebinding,
		corerole,
		role,
		rolebinding,
		resourcepermission,
		user,
		team,
		teambinding,
		serviceaccount,
	]
}
