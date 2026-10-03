package kinds

import (
	"github.com/grafana/grafana/apps/foldernaming/kinds/v0alpha1"
)

folderNamingPolicyKind: {
	kind:       "FolderNamingPolicy"
	pluralName: "FolderNamingPolicies"
}

folderNamingPolicyv0alpha1: folderNamingPolicyKind & {
	schema: {
		spec:   v0alpha1.#FolderNamingPolicySpec
		status: v0alpha1.#FolderNamingPolicyStatus
	}
	validation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
}
