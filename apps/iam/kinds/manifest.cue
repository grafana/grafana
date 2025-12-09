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
			"/searchUser": {
				"GET": {
					response: {
						offset: int64
						totalHits: int64
						hits: [...#UserHit]
						queryCost: float64
						maxScore: float64
					}
					request: {
						query: {
							query: string
							limit?:  int64 | 10
							offset?: int64 | 1
						}
					}
					responseMetadata: {
						typeMeta: false
						objectMeta: false
					}
				}
			}
		}
	}
}

#UserHit: {
	name: string
	title: string
	login: string
	email: string
	role: string
	lastSeenAt: int64
	lastSeenAtAge: string
	provisioned: bool
	score: float64
}
