package annotation

import (
	"context"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

func namespaceToOrgID(ctx context.Context, namespace string) (int64, error) {
	info, err := claims.ParseNamespace(namespace)
	return info.OrgID, err
}

func orgIDToNamespace(mapper request.NamespaceMapper, orgID int64) string {
	return mapper(orgID)
}
