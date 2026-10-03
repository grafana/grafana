package kinds

manifest: {
	appName:       "rulepolicy"
	groupOverride: "rulepolicy.alerting.grafana.app"
	versions: {
		"v0alpha1": {
			// Disabled by default while experimental. Requires policy.grafana.app/v0alpha1. Enable with
			// [grafana-apiserver] runtime_config = policy.grafana.app/v0alpha1=true,rulepolicy.alerting.grafana.app/v0alpha1=true
			served: false
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			kinds: [
				rulePolicyv0alpha1,
			]
		}
	}
	extraPermissions: {
		// The reconciler writes the validation policies and bindings that enforce a RulePolicy.
		accessKinds: [
			{
				group:    "policy.grafana.app"
				resource: "validationpolicies"
				actions: ["get", "list", "watch", "create", "update", "delete"]
			},
			{
				group:    "policy.grafana.app"
				resource: "validationpolicybindings"
				actions: ["get", "list", "watch", "create", "update", "delete"]
			},
		]
	}
	roles: {}
}
