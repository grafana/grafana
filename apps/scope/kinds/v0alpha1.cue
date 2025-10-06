package kinds

v0alpha1: {
	kinds: [
		Scope,
		ScopeDashboardBinding,
		FindScopeDashboardBindingsResults,
		ScopeNode,
		FindScopeNodeChildrenResults,
		ScopeNavigation,
		FindScopeNavigationResults,
	]
	codegen: {
		ts: {
			// Generate for the React type instead
			enabled: false
		}
		go: {
			enabled: true
		}
	}
}

Scope: {
	kind:       "Scope"
	pluralName: "Scopes"
	schema: {
		spec: {
			title: string

			// Provides a default path for the scope. This refers to a list of nodes in the selector. This is used to display the title next to the selected scope and expand the selector to the proper path.
			// This will override whichever is selected from in the selector.
			// The path is a list of node ids, starting at the direct parent of the selected node towards the root.
			// +listType=atomic
			defaultPath?: [...string]

			// +listType=atomic
			filters?: [...ScopeFilter]
		}
	}
}

FilterOperator: "equals" | "not-equals" | "regex-match" | "regex-not-match" | "one-of" | "not-one-of" @cog(kind="enum",memberNames="Equals|NotEquals|RegexMatch|RegexNotMatch|OneOf|NotOneOf")

ScopeFilter: {
	key:   string
	value: string
	// Values is used for operators that require multiple values (e.g. one-of and not-one-of).
	// +listType=atomic
	values: [...string]
	operator: FilterOperator
}

ScopeDashboardBinding: {
	kind:       "ScopeDashboardBinding"
	pluralName: "ScopeDashboardBindings"
	schema: {
		spec: {
			dashboard: string
			scope:     string
		}
		status: {
			// DashboardTitle should be populated and update from the dashboard
			dashboardTitle: string

			// Groups is used for the grouping of dashboards that are suggested based
			// on a scope. The source of truth for this information has not been
			// determined yet.
			groups?: [...string]
		}
	}
}

FindScopeDashboardBindingsResults: {
	kind:       "FindScopeDashboardBindingsResults"
	pluralName: "FindScopeDashboardBindingsResults"
	schema: {
		spec: {
			message?: string
			items?: [...ScopeDashboardBinding] @cuetsy(kind="type")
		}
	}
}

ScopeNode: {
	kind:       "ScopeNode"
	pluralName: "ScopeNodes"
	schema: {
		spec: {
			//+optional
			parentName?: string

			nodeType: "container" | "leaf" @cog(kind="enum",memberNames="Container|Leaf")

			title:              string
			description?:       string
			disableMultiSelect: bool
			linkType?:          "scope" @cog(kind="enum",memberNames="Scope") // scope (later more things)
			linkId?:            string  // the k8s name

			// ?? should this be a slice of links
		}
	}
}

FindScopeNodeChildrenResults: {
	kind:       "FindScopeNodeChildrenResults"
	pluralName: "FindScopeNodeChildrenResults"
	schema: {
		spec: {
			items?: [...ScopeNode]
		}
	}
}

ScopeNavigation: {
	kind:       "ScopeNavigation"
	pluralName: "ScopeNavigations"
	schema: {
		spec: {
			url:   string
			scope: string
		}
		status: {
			// Title should be populated and update from the dashboard
			title: string

			// Groups is used for the grouping of dashboards that are suggested based
			// on a scope. The source of truth for this information has not been
			// determined yet.
			groups?: [...string]
		}
	}
}

FindScopeNavigationResults: {
	kind:       "FindScopeNavigationsResults"
	pluralName: "FindScopeNavigationsResults"
	schema: {
		spec: {
			message?: string
			items?: [...ScopeNavigation]
		}
	}
}
