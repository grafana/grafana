package request

import (
	"context"
	"strconv"

	"k8s.io/apiserver/pkg/endpoints/request"
)

func OrgIDFrom(ctx context.Context) (int64, bool) {
	ns := request.NamespaceValue(ctx)
	return ParseOrgID(ns)
}

func ParseOrgID(ns string) (int64, bool) {
	if len(ns) < 5 || ns[:4] != "org-" {
		return 0, false
	}

	orgID, err := strconv.Atoi(ns[4:])
	if err != nil {
		return 0, false
	}

	return int64(orgID), true
}
