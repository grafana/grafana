package util

import (
	"fmt"
	"strconv"
	"strings"
)

func OrgIdToNamespace(orgId int64) string {
	if orgId > 1 {
		return fmt.Sprintf("org-%d", orgId)
	}
	return "default"
}

func NamespaceToOrgID(ns string) (int64, error) {
	parts := strings.Split(ns, "-")
	switch len(parts) {
	case 1:
		if parts[0] == "default" {
			return 1, nil
		}
		return 0, fmt.Errorf("invalid namespace")
	case 2:
		if !(parts[0] == "org" || parts[0] == "tenant") {
			return 0, fmt.Errorf("invalid namespace (org|tenant)")
		}
		n, err := strconv.ParseInt(parts[1], 10, 64)
		if err != nil {
			return 0, fmt.Errorf("invalid namepscae (%w)", err)
		}
		return n, nil
	}
	return 0, fmt.Errorf("invalid namespace")
}
