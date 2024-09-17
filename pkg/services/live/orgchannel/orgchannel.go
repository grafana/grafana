package orgchannel

import (
	"fmt"
	"strconv"
	"strings"
)

// PrependOrgID prepends orgID to a channel.
func PrependOrgID(orgID int64, channel string) string {
	return strconv.FormatInt(orgID, 10) + "/" + channel
}

// StripOrgID strips organization ID from channel ID.
// The reason why we strip orgID is because we need to maintain multi-tenancy.
// Each organization can have the same channels which should not overlap. Due
// to this every channel in Centrifuge has orgID prefix. Internally in Grafana
// we strip this prefix since orgID is part of user identity and channel handlers
// supposed to have the same business logic for all organizations.
func StripOrgID(channel string) (int64, string, error) {
	parts := strings.SplitN(channel, "/", 2)
	if len(parts) != 2 {
		return 0, "", fmt.Errorf("malformed channel: %s", channel)
	}
	orgID, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return 0, "", fmt.Errorf("invalid orgID part: %s", parts[0])
	}
	return orgID, parts[1], nil
}
