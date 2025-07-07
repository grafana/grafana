package kinds

import (
	"strings"
)

lbacrule: {
	kind:       "LBACRule"
	pluralName: "LBACRules"
	current:    "v0alpha1"
	
	codegen: {
		ts: {
			enabled: false
		}
		go: {
			enabled: true
		}
	}

	versions: {
		"v0alpha1": {
			schema: {
				spec: {
					// The data source this LBAC configuration applies to
					datasourceUID: string
					
					// The rules defining team-based access control
					rules: [...#TeamLBACRule]
				}
			}
		}
	}
}
 
// TeamLBACRule defines access control rules for a specific team
#TeamLBACRule: {
	// The team identifier (UID)
	teamUID: string & strings.MinRunes(1)
	
	// The list of label-based access control rules
	// Each rule should follow the Prometheus/Loki label selector format
	// Example: { name!="value", foo!~"bar" }
	rules: [...string]
}