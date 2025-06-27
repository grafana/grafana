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
		// serviceaccounttoken, // TODO: in the previous implementation it was not a kind, but a custom response type
		userteam,
	]
}
