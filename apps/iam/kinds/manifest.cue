package kinds

manifest: {
	appName: 	   "iam"
	groupOverride: "iam.grafana.app"
	extraPermissions: {
		accessKinds: [
			{
				group: "folder.grafana.app"
				resource: "folders"
				actions: ["list","watch"]
			}
		]
	}
	versions: {
	    "v0alpha1": v0alpha1
	}
}

v0alpha1: {
    kinds: [
		globalrolev0alpha1,
		globalrolebindingv0alpha1,
		corerolev0alpha1,
		rolev0alpha1,
		rolebindingv0alpha1,
		resourcepermissionv0alpha1,
		userv0alpha1,
		teamv0alpha1,
		teambindingv0alpha1,
		serviceaccountv0alpha1,
	]
}
