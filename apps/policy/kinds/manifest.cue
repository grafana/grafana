package kinds

manifest: {
	appName:       "policy"
	groupOverride: "policy.grafana.app"
	versions: {
		"v0alpha1": {
			// Disabled by default while experimental. Enable with
			// [grafana-apiserver] runtime_config = policy.grafana.app/v0alpha1=true
			served: false
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [
				validationPolicyv0alpha1,
				validationPolicyBindingv0alpha1,
			]
		}
	}
	roles: {}
}
