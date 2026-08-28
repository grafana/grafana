package connections

import (
	"context"

	authlib "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
)

// allowedChecker compiles the caller's per-datasource read permission once for
// the whole list, rather than issuing a check per row.
func (s *legacySQLStore) allowedChecker(ctx context.Context, ns authlib.NamespaceInfo) (authlib.ItemChecker, error) {
	if s.accessClient == nil {
		return func(string, string) bool { return true }, nil
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, apierrors.NewUnauthorized("valid user is required")
	}

	//nolint:staticcheck // SA1019: Compile is deprecated but BatchCheck is not yet fully implemented
	checker, _, err := s.accessClient.Compile(ctx, user, authlib.ListRequest{
		Group:     datasourceV0.GROUP,
		Resource:  datasourceV0.DataSourceResourceInfo.GetName(),
		Namespace: ns.Value,
		Verb:      "get",
	})
	if err != nil {
		return nil, err
	}
	if checker == nil {
		// No access to any matching item
		return func(string, string) bool { return false }, nil
	}
	return checker, nil
}
