package orgchannel

import (
	"fmt"
	"strconv"
	"strings"
)

func PrependOrgID(orgID int64, channel string) string {
	return strconv.FormatInt(orgID, 10) + "/" + channel
}

func StripOrgID(channel string) (int64, string, error) {
	parts := strings.SplitN(channel, "/", 1)
	if len(parts) != 2 {
		return 0, "", fmt.Errorf("malformed channel: %s", channel)
	}
	orgID, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return 0, "", fmt.Errorf("invalid orgID part: %s", parts[0])
	}
	return orgID, parts[1], nil
}
