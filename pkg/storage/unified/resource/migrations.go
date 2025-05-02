package resource

import (
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
)

// MigrateVersionMatch handles backwards compatibility for ResourceVersionMatch
// by migrating from the deprecated version_match to version_match_v2.
// It returns an error if the version match is unknown.
func MigrateListRequestVersionMatch(req *ListRequest, logger logging.Logger) error {
	if req.VersionMatch != nil && req.GetVersionMatchV2() == ResourceVersionMatchV2_UNKNOWN {
		switch req.GetVersionMatch() {
		case ResourceVersionMatch_DEPRECATED_NotOlderThan:
			// This is not a typo. The old implementation actually did behave like Unset.
			req.VersionMatchV2 = ResourceVersionMatchV2_Unset
		case ResourceVersionMatch_DEPRECATED_Exact:
			req.VersionMatchV2 = ResourceVersionMatchV2_Exact
		default:
			return fmt.Errorf("unknown version match: %v", req.GetVersionMatch())
		}

		// Log the migration to measure whether we have successfully migrated all clients
		logger.Info("Old client request received, migrating from version_match to version_match_v2",
			"oldValue", req.GetVersionMatch(),
			"newValue", req.GetVersionMatchV2())
	}
	return nil
}
