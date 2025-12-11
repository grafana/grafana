package kinds

manifest: {
	appName: 	   "iam"
	groupOverride: "iam.grafana.app"
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
		externalGroupMappingv0alpha1
	]
	routes: {
		namespaced: {
			"/searchTeams": {
				"GET": {
					request: {
						query: { 
							query?: string
						}
					}
					response: {
						#TeamHit: {
							name: string
							title: string
							email: string
							provisioned: bool
							externalUID: string
						}
						offset: int64
						totalHits: int64
						hits: [...#TeamHit]
						queryCost: float64
						maxScore: float64
					}
					responseMetadata: objectMeta: false
				}
			}
		}
	}
}
