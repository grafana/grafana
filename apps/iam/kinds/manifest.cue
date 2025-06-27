package kinds

manifest: {
	appName:       "iam"
	groupOverride: "iam.grafana.app"
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
		// serviceaccounttoken, // TODO: this is a subresource, how to define it in CUE?
		// userteam, // TODO: this is a subresource, how to define it in CUE?
	]
}
