package team

import (
	"context"
	"errors"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// IsK8sRedirectEnabledForNamespace gates team operations on the k8s apiserver path.
// The namespace is required because redirect flags may be targeted per stack; evaluating
// without it could select a non-authoritative Team store for the request.
// FIXME: drop the UsersApi requirement once teamk8s no longer needs the k8s users resource for enrichment.
func IsK8sRedirectEnabledForNamespace(ctx context.Context, client *openfeature.Client, namespace string) (bool, error) {
	if namespace == "" {
		return false, errors.New("namespace is required to evaluate the Team k8s redirect")
	}
	if client == nil {
		return false, nil
	}

	ctx = openfeature.MergeTransactionContext(ctx, openfeature.NewEvaluationContext(namespace, map[string]any{
		"namespace": namespace,
	}))
	txCtx := openfeature.TransactionContext(ctx)
	if !client.Boolean(ctx, featuremgmt.FlagKubernetesTeamsApi, false, txCtx) {
		return false, nil
	}
	if !client.Boolean(ctx, featuremgmt.FlagKubernetesTeamsRedirect, false, txCtx) {
		return false, nil
	}
	return client.Boolean(ctx, featuremgmt.FlagKubernetesUsersApi, false, txCtx), nil
}
