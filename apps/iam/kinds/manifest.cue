package kinds

manifest: {
	appName:       "iam"
	groupOverride: "iam.grafana.app"
	versions: {
		"v0alpha1": {
			codegen: {
				ts: enabled: false
				go: enabled: true
			}
			kinds: [
				rolev0alpha1,
				rolebindingv0alpha1,
				globalrolebindingv0alpha1,
				resourcepermissionv0alpha1,
				userv0alpha1,
				teamv0alpha1,
				teambindingv0alpha1,
				serviceaccountv0alpha1,
			]
		}
	}
}
