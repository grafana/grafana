package authinfoimpl

import (
	"context"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
)

// redirectStore is a login.Store that redirects to the k8s-backed AuthInfo
// store when FlagKubernetesAuthInfoRedirect is enabled and to the legacy SQL
// store otherwise.
type redirectStore struct {
	legacyStore       login.Store
	k8sStore          login.Store
	openFeatureClient *openfeature.Client
	logger            log.Logger
}

var _ login.Store = (*redirectStore)(nil)

func newRedirectStore(legacyStore, k8sStore login.Store) *redirectStore {
	return &redirectStore{
		legacyStore:       legacyStore,
		k8sStore:          k8sStore,
		openFeatureClient: openfeature.NewDefaultClient(),
		logger:            log.New("login.authinfo.redirect"),
	}
}

func (s *redirectStore) GetAuthInfo(ctx context.Context, query *login.GetAuthInfoQuery) (*login.UserAuth, error) {
	if s.isKubernetesAuthInfoRedirectEnabled(ctx) {
		return s.k8sStore.GetAuthInfo(ctx, query)
	}
	return s.legacyStore.GetAuthInfo(ctx, query)
}

func (s *redirectStore) GetUsersRecentlyUsedLabel(ctx context.Context, query login.GetUserLabelsQuery) (map[int64]string, error) {
	if s.isKubernetesAuthInfoRedirectEnabled(ctx) {
		return s.k8sStore.GetUsersRecentlyUsedLabel(ctx, query)
	}
	return s.legacyStore.GetUsersRecentlyUsedLabel(ctx, query)
}

func (s *redirectStore) GetUserAuthModules(ctx context.Context, userID int64) ([]string, error) {
	if s.isKubernetesAuthInfoRedirectEnabled(ctx) {
		return s.k8sStore.GetUserAuthModules(ctx, userID)
	}
	return s.legacyStore.GetUserAuthModules(ctx, userID)
}

func (s *redirectStore) SetAuthInfo(ctx context.Context, cmd *login.SetAuthInfoCommand) error {
	if s.isKubernetesAuthInfoRedirectEnabled(ctx) {
		return s.k8sStore.SetAuthInfo(ctx, cmd)
	}
	return s.legacyStore.SetAuthInfo(ctx, cmd)
}

func (s *redirectStore) UpdateAuthInfo(ctx context.Context, cmd *login.UpdateAuthInfoCommand) error {
	if s.isKubernetesAuthInfoRedirectEnabled(ctx) {
		return s.k8sStore.UpdateAuthInfo(ctx, cmd)
	}
	return s.legacyStore.UpdateAuthInfo(ctx, cmd)
}

func (s *redirectStore) DeleteUserAuthInfo(ctx context.Context, userID int64) error {
	if s.isKubernetesAuthInfoRedirectEnabled(ctx) {
		return s.k8sStore.DeleteUserAuthInfo(ctx, userID)
	}
	return s.legacyStore.DeleteUserAuthInfo(ctx, userID)
}

func (s *redirectStore) DeleteAuthInfo(ctx context.Context, cmd *login.DeleteAuthInfoCommand) error {
	if s.isKubernetesAuthInfoRedirectEnabled(ctx) {
		return s.k8sStore.DeleteAuthInfo(ctx, cmd)
	}
	return s.legacyStore.DeleteAuthInfo(ctx, cmd)
}

func (s *redirectStore) isKubernetesAuthInfoRedirectEnabled(ctx context.Context) bool {
	if s.openFeatureClient == nil {
		return false
	}
	return s.openFeatureClient.Boolean(ctx, featuremgmt.FlagKubernetesAuthInfoRedirect, false, openfeature.TransactionContext(ctx))
}
