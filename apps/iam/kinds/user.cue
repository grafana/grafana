package kinds

import (
	"github.com/grafana/grafana/apps/iam/kinds/v0alpha1"
)

userKind: {
	kind:       "User"
	pluralName: "Users"
	codegen: {
		ts: {enabled: false}
		go: {enabled: true}
	}
}

userv0alpha1: userKind & {
	// TODO: Uncomment this when User will be added to ManagedKinds 
	// validation: {
	// 	operations: [
	// 		"CREATE",
	// 		"UPDATE",
	// 	]
	// }
	// mutation: {
	// 	operations: [
	// 		"CREATE",
	// 		"UPDATE",
	// 	]
	// }
	schema: {
		spec: v0alpha1.UserSpec
	}
	// TODO: Uncomment when the custom routes implementation is done
	// routes: {
	// 	"/teams": {
	// 		"GET": {
	// 			response: {
	// 				#UserTeam: {
	// 					title: string
	// 					teamRef: v0alpha1.TeamRef
	// 					permission: v0alpha1.TeamPermission
	// 				}
	// 				items: [...#UserTeam]
	// 			}
	// 		}
	// 	}
	// }
}
