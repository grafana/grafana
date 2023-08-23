package libraryelements

import (
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

const (
	ScopeLibraryPanelsRoot   = "library.panels"
	ScopeLibraryPanelsPrefix = "library.panels:uid:"

	ActionLibraryPanelsCreate = "library.panels:create"
	ActionLibraryPanelsRead   = "library.panels:read"
	ActionLibraryPanelsWrite  = "library.panels:write"
	ActionLibraryPanelsDelete = "library.panels:delete"
)

var (
	ScopeLibraryPanelsProvider = ac.NewScopeProvider(ScopeLibraryPanelsRoot)

	ScopeLibraryPanelsAll = ScopeLibraryPanelsProvider.GetResourceAllScope()
)
