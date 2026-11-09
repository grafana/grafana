package navtree

import (
	"strconv"

	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/util"
)

// NavigationPlacement is one `<sectionId> <sortWeight>` value from the
// [navigation.app_sections] and [navigation.app_standalone_pages] INI sections,
// keyed by plugin id and by page path respectively.
type NavigationPlacement struct {
	SectionID  string `json:"sectionId"`
	SortWeight int64  `json:"sortWeight,omitempty"`
}

// ParseNavigationPlacements parses one of those sections. Shared by the
// server-built tree and by the frontend settings the client-built tree reads, so
// the two cannot come to disagree about the format.
//
// Values are read key by key rather than through KeysHash, which returns them
// raw: only Key.String expands the %(name)s macros the ini format allows.
//
// A value with no weight, or an unparseable one, yields a zero weight, which
// both trees sort as "wherever it was appended".
func ParseNavigationPlacements(section *ini.Section) map[string]NavigationPlacement {
	keys := section.Keys()
	if len(keys) == 0 {
		return nil
	}

	placements := make(map[string]NavigationPlacement, len(keys))
	for _, key := range keys {
		// util.SplitString, as the server-built tree has always parsed these
		fields := util.SplitString(key.MustString(""))
		if len(fields) == 0 {
			continue
		}

		placement := NavigationPlacement{SectionID: fields[0]}
		if len(fields) > 1 {
			if weight, err := strconv.ParseInt(fields[1], 10, 64); err == nil {
				placement.SortWeight = weight
			}
		}
		placements[key.Name()] = placement
	}

	return placements
}
