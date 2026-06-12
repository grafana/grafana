package kinds

manifest: {
	appName:       "iam"
	groupOverride: "iam.grafana.app"
	versions: {
		"v0alpha1": v0alpha1
	}
	roles: {}
}

v0alpha1: {
	kinds: [
		globalrolev0alpha1,
		globalrolebindingv0alpha1,
		rolev0alpha1,
		rolebindingv0alpha1,
		resourcepermissionv0alpha1,
		userv0alpha1,
		teamv0alpha1,
		teambindingv0alpha1,
		teamlbacrulev0alpha1,
		serviceaccountv0alpha1,
		externalGroupMappingv0alpha1,
	]

	routes: {
		namespaced: {
			"/searchUsers": {
				"GET": {
					name: "getSearchUsers"
					request: {
						query: {
							query?:  string
							limit?:  int64 | 10
							offset?: int64 | 0
							page?:   int64 | 1
						}
					}
					response: {
						offset:    int64
						totalHits: int64
						hits: [...#UserHit]
						queryCost: float64
						maxScore:  float64
					}
					responseMetadata: {
						typeMeta:   false
						objectMeta: false
					}
				}
			}
			"/searchTeams": {
				"GET": {
					name: "getSearchTeams"
					request: {
						query: {
							query?:  string
							limit?:  int64 | 50
							offset?: int64 | 0
							page?:   int64 | 1
						}
					}
					response: {
						#TeamHit: {
							name:         string
							title:        string
							email:        string
							provisioned:  bool
							externalUID:  string
							memberCount?: int64
							accessControl?: {[string]: bool}
						}
						offset:    int64
						totalHits: int64
						hits: [...#TeamHit]
						queryCost: float64
						maxScore:  float64
					}
					responseMetadata: objectMeta: false
				}
			}
			"/searchExternalGroupMappings": {
				"POST": {
					name: "createSearchExternalGroupMappings"
					request: {
						query: {
							limit?:  int64 | 30
							page?:   int64 | 1
							offset?: int64 | 0
						}
						body: {
							externalGroups?: [...string]
						}
					}
					response: {
						// Deduplicated team UIDs whose spec.externalGroups intersect the request set.
						teams: [...string]
						// Raw match count; may exceed len(teams) in legacy storage mode where one team can match through multiple group rows. Use to drive pagination, not as a team count.
						totalHits: int64
					}
					responseMetadata: objectMeta: false
				}
			}
		}
	}
}

#UserHit: {
	name:          string
	title:         string
	login:         string
	email:         string
	role:          string
	lastSeenAt:    int64
	lastSeenAtAge: string
	provisioned:   bool
	disabled:      bool
	// Deprecated internal (legacy SQL) id of the user.
	internalId: int64
	// Creation timestamp, in epoch milliseconds.
	created: int64
	score:   float64
	accessControl?: {[string]: bool}
}
