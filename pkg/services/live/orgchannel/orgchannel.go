package orgchannel

import (
	"fmt"
	"strconv"
	"strings"

	authlib "github.com/grafana/authlib/types"
)

// Prefix the k8s namespace to the channel.
func PrependK8sNamespace(ns string, channel string) string {
	return ns + "/" + channel
}

// StripK8sNamespace strips k8s namespace from the full channel ID.
// We use the k8s namespace for multi-tenancy across orgs and stacks
func StripK8sNamespace(channel string) (authlib.NamespaceInfo, string, error) {
	parts := strings.SplitN(channel, "/", 2)
	if len(parts) != 2 {
		return authlib.NamespaceInfo{}, "", fmt.Errorf("malformed channel: %s", channel)
	}

	// Temporarily support the
	orgId, err := strconv.ParseInt(parts[0], 16, 64)
	if err == nil && orgId > 0 {
		return authlib.NamespaceInfo{
			Value:   authlib.OrgNamespaceFormatter(orgId), // default or org-XYZ
			OrgID:   orgId,
			StackID: 0,
		}, parts[1], nil
	}

	ns, err := authlib.ParseNamespace(parts[0])
	if err == nil && ns.OrgID < 1 {
		return ns, "", fmt.Errorf("namespace does not reference a valid org ID: %s", parts[0])
	}
	return ns, parts[1], err
}
