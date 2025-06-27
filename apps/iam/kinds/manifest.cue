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
		serviceaccounttoken,
		userteam,
	]
}
