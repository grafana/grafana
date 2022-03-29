package guardian

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type Provider struct{}

func ProvideService(store *sqlstore.SQLStore, ac accesscontrol.AccessControl, permissionsServices accesscontrol.PermissionsServices, features featuremgmt.FeatureToggles) *Provider {
	if features.IsEnabled(featuremgmt.FlagAccesscontrol) {
		// TODO: Fix this hack, see https://github.com/grafana/grafana-enterprise/issues/2935
		InitAcessControlGuardian(store, ac, permissionsServices)
	} else {
		InitLegacyGuardian(store)
	}
	return &Provider{}
}

func InitLegacyGuardian(store sqlstore.Store) {
	New = func(ctx context.Context, dashId int64, orgId int64, user *models.SignedInUser) DashboardGuardian {
		return newDashboardGuardian(ctx, dashId, orgId, user, store)
	}
}

func InitAcessControlGuardian(store sqlstore.Store, ac accesscontrol.AccessControl, permissionsServices accesscontrol.PermissionsServices) {
	New = func(ctx context.Context, dashId int64, orgId int64, user *models.SignedInUser) DashboardGuardian {
		return NewAccessControlDashboardGuardian(ctx, dashId, user, store, ac, permissionsServices)
	}
}
