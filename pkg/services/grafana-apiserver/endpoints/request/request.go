package request

import (
	"context"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"k8s.io/apiserver/pkg/endpoints/request"
)

func OrgIDFrom(ctx context.Context) (int64, bool) {
	ns := request.NamespaceValue(ctx)
	if ns == "" || ns == "default" {
		u, err := appcontext.User(ctx)
		if err == nil && u != nil {
			return u.OrgID, true
		}
		return 0, false
	}
	if len(ns) < 5 || ns[:4] != "org-" {
		return 0, false
	}

	orgID, err := strconv.Atoi(ns[4:])
	if err != nil {
		return 0, false
	}

	return int64(orgID), true
}
