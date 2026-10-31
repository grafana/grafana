package navtree

import (
	"strconv"

	"github.com/grafana/grafana/pkg/util"
)

// NavigationPlacement is one `<sectionId> <sortWeight>` value from the
// [navigation.app_sections] and [navigation.app_standalone_pages] INI sections,
// keyed by plugin id and by page path respectively.
type NavigationPlacement struct {
	SectionID  string `json:"sectionId"`
	SortWeight int64  `json:"sortWeight,omitempty"`
}

// ParseNavigationPlacements parses one of those sections, given its keys as a
// name/value map (ini's KeysHash). Shared by the server-built tree and by the
// frontend settings the client-built tree reads, so the two cannot come to
// disagree about the format.
//
// A value with no weight, or an unparseable one, yields a zero weight, which
// both trees sort as "wherever it was appended".
func ParseNavigationPlacements(values map[string]string) map[string]NavigationPlacement {
	if len(values) == 0 {
		return nil
	}

	placements := make(map[string]NavigationPlacement, len(values))
	for key, value := range values {
		// util.SplitString, as the server-built tree has always parsed these
		fields := util.SplitString(value)
		if len(fields) == 0 {
			continue
		}

		placement := NavigationPlacement{SectionID: fields[0]}
		if len(fields) > 1 {
			if weight, err := strconv.ParseInt(fields[1], 10, 64); err == nil {
				placement.SortWeight = weight
			}
		}
		placements[key] = placement
	}

	return placements
}
