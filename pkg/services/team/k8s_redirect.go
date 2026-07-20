package team

import (
	"context"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// IsK8sRedirectEnabled gates team operations on the k8s apiserver path.
// FIXME: drop the UsersApi requirement once teamk8s no longer needs the k8s users resource for enrichment.
func IsK8sRedirectEnabled(ctx context.Context, client *openfeature.Client) bool {
	if client == nil {
		return false
	}

	txCtx := openfeature.TransactionContext(ctx)
	if !client.Boolean(ctx, featuremgmt.FlagKubernetesTeamsApi, false, txCtx) {
		return false
	}
	if !client.Boolean(ctx, featuremgmt.FlagKubernetesTeamsRedirect, false, txCtx) {
		return false
	}
	return client.Boolean(ctx, featuremgmt.FlagKubernetesUsersApi, false, txCtx)
}
