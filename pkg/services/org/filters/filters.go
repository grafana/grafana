package filters

import (
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/org"
)

const roleFilter = "role"

var orgFltLog = log.New("org filters")

type OSSOrgUserSearchFilter struct {
	availableFilters map[string]org.FilterHandler
}

func ProvideOSSOrgUserSearchFilter() *OSSOrgUserSearchFilter {
	handler := &OSSOrgUserSearchFilter{
		availableFilters: make(map[string]org.FilterHandler),
	}

	handler.availableFilters[roleFilter] = NewOrgRoleFilter

	return handler
}

func (h *OSSOrgUserSearchFilter) GetFilter(filterName string, params []string) org.Filter {
	if filterFunc, exists := h.availableFilters[filterName]; exists {
		if len(params) == 0 {
			return nil
		}
		return filterFunc(params)
	}

	orgFltLog.Warn("Unknown filter requested", "filterName", filterName)
	return nil
}

func (h *OSSOrgUserSearchFilter) GetFilterList() map[string]org.FilterHandler {
	return h.availableFilters
}
