package routes

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	ac "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	acfakes "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol/fakes"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

const importedConfigYaml = `
route:
  receiver: imported-receiver
receivers:
  - name: imported-receiver
    webhook_configs:
      - url: "http://localhost/"
`

type nopTransactionManager struct{}

func (n *nopTransactionManager) InTransaction(_ context.Context, work func(ctx context.Context) error) error {
	return work(context.Background())
}

func createServiceSut(
	configStore *legacy_storage.AlertmanagerConfigStoreFake,
	provStore *fakes.FakeProvisioningStore,
	features featuremgmt.FeatureToggles,
	routeAccess routeAccessControl,
) *Service {
	return &Service{
		configStore:     configStore,
		provenanceStore: provStore,
		xact:            &nopTransactionManager{},
		log:             log.NewNopLogger(),
		settings: setting.UnifiedAlertingSettings{
			DefaultConfiguration: setting.GetAlertmanagerDefaultConfiguration(),
		},
		provenanceStatusTransitionValidator: func(_ context.Context, from, to models.Provenance) error {
			return nil
		},
		FeatureToggles: features,
		tracer:         tracing.InitializeTracerForTest(),
		routeAccess:    routeAccess,
	}
}

func configRevisionWithImportedRoute() *legacy_storage.ConfigRevision {
	return &legacy_storage.ConfigRevision{
		Config: &v1.AMConfigV1{
			AlertmanagerConfig: v1.PostableApiAlertingConfig{
				Config: v1.Config{
					Route: &v1.Route{Receiver: "grafana-default"},
				},
				Receivers: []*v1.PostableApiReceiver{
					{Receiver: definitions.Receiver{Name: "grafana-default"}},
				},
			},
			ExtraConfigs: []v1.ExtraConfiguration{
				{
					Identifier:         "imported",
					AlertmanagerConfig: importedConfigYaml,
				},
			},
		},
		ConcurrencyToken: "test-token",
	}
}

func configRevisionWithManagedRoutes() *legacy_storage.ConfigRevision {
	return &legacy_storage.ConfigRevision{
		Config: &v1.AMConfigV1{
			AlertmanagerConfig: v1.PostableApiAlertingConfig{
				Config: v1.Config{
					Route: &v1.Route{Receiver: "grafana-default"},
				},
				Receivers: []*v1.PostableApiReceiver{
					{Receiver: definitions.Receiver{Name: "grafana-default"}},
					{Receiver: definitions.Receiver{Name: "empty"}},
				},
			},
			ManagedRoutes: v1.ManagedRoutes{
				"route-a": &v1.Route{Receiver: "grafana-default"},
				"route-b": &v1.Route{Receiver: "grafana-default"},
			},
		},
		ConcurrencyToken: "test-token",
	}
}

func TestGetManagedRoute(t *testing.T) {
	orgID := int64(1)

	user := &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
		1: {
			accesscontrol.ActionAlertingManagedRoutesRead: []string{models.ScopeRoutesProvider.GetResourceAllScope()},
		},
	}}

	t.Run("imported route preserves provenance and does not query provenance store", func(t *testing.T) {
		rev := configRevisionWithImportedRoute()
		configStore := &legacy_storage.AlertmanagerConfigStoreFake{
			GetFn: func(_ context.Context, _ int64) (*legacy_storage.ConfigRevision, error) {
				return rev, nil
			},
		}
		provStore := fakes.NewFakeProvisioningStore()
		features := featuremgmt.WithFeatures(featuremgmt.FlagAlertingImportAlertmanagerAPI)

		sut := createServiceSut(configStore, provStore, features, &acfakes.FakeRouteAccessService[*legacy_storage.ManagedRoute]{})

		route, err := sut.GetManagedRoute(context.Background(), orgID, "imported", user)
		require.NoError(t, err)

		assert.Equal(t, models.ProvenanceConvertedPrometheus, route.Provenance)
		assert.Equal(t, models.ResourceOriginImported, route.Origin)

		// Provenance store should NOT have been called for imported routes.
		for _, call := range provStore.Calls {
			assert.NotEqual(t, "GetProvenance", call.MethodName,
				"provenance store should not be queried for imported routes")
		}
	})

	t.Run("grafana route uses provenance from store", func(t *testing.T) {
		rev := configRevisionWithImportedRoute()
		configStore := &legacy_storage.AlertmanagerConfigStoreFake{
			GetFn: func(_ context.Context, _ int64) (*legacy_storage.ConfigRevision, error) {
				return rev, nil
			},
		}
		provStore := fakes.NewFakeProvisioningStore()
		provStore.GetProvenanceFunc = func(_ context.Context, _ models.Provisionable, _ int64) (models.Provenance, error) {
			return models.ProvenanceAPI, nil
		}
		features := featuremgmt.WithFeatures(featuremgmt.FlagAlertingImportAlertmanagerAPI)

		sut := createServiceSut(configStore, provStore, features, &acfakes.FakeRouteAccessService[*legacy_storage.ManagedRoute]{})

		route, err := sut.GetManagedRoute(context.Background(), orgID, models.DefaultRoutingTreeName, user)
		require.NoError(t, err)

		assert.Equal(t, models.ProvenanceAPI, route.Provenance)
		assert.Equal(t, models.ResourceOriginGrafana, route.Origin)

		require.Len(t, provStore.Calls, 1)
		assert.Equal(t, "GetProvenance", provStore.Calls[0].MethodName)
	})

	t.Run("propagates provenance store error for grafana route", func(t *testing.T) {
		rev := configRevisionWithImportedRoute()
		configStore := &legacy_storage.AlertmanagerConfigStoreFake{
			GetFn: func(_ context.Context, _ int64) (*legacy_storage.ConfigRevision, error) {
				return rev, nil
			},
		}
		expectedErr := errors.New("provenance store failure")
		provStore := fakes.NewFakeProvisioningStore()
		provStore.GetProvenanceFunc = func(_ context.Context, _ models.Provisionable, _ int64) (models.Provenance, error) {
			return models.ProvenanceNone, expectedErr
		}
		features := featuremgmt.WithFeatures(featuremgmt.FlagAlertingImportAlertmanagerAPI)

		sut := createServiceSut(configStore, provStore, features, &acfakes.FakeRouteAccessService[*legacy_storage.ManagedRoute]{})

		_, err := sut.GetManagedRoute(context.Background(), orgID, models.DefaultRoutingTreeName, user)
		require.ErrorIs(t, err, expectedErr)
	})

	t.Run("imported route provenance is consistent between get and list", func(t *testing.T) {
		rev := configRevisionWithImportedRoute()
		configStore := &legacy_storage.AlertmanagerConfigStoreFake{
			GetFn: func(_ context.Context, _ int64) (*legacy_storage.ConfigRevision, error) {
				return rev, nil
			},
		}
		provStore := fakes.NewFakeProvisioningStore()
		features := featuremgmt.WithFeatures(featuremgmt.FlagAlertingImportAlertmanagerAPI)

		sut := createServiceSut(configStore, provStore, features, &acfakes.FakeRouteAccessService[*legacy_storage.ManagedRoute]{})

		singleRoute, err := sut.GetManagedRoute(context.Background(), orgID, "imported", user)
		require.NoError(t, err)

		allRoutes, err := sut.GetManagedRoutes(context.Background(), orgID, user)
		require.NoError(t, err)

		var listRoute *legacy_storage.ManagedRoute
		for _, r := range allRoutes {
			if r.Name == "imported" {
				listRoute = r
				break
			}
		}
		require.NotNil(t, listRoute, "imported route should be present in list")
		assert.Equal(t, singleRoute.Provenance, listRoute.Provenance,
			"provenance should be the same in single-get and list views")
		assert.Equal(t, models.ProvenanceConvertedPrometheus, singleRoute.Provenance)
	})

	t.Run("returns not found for unknown route", func(t *testing.T) {
		rev := configRevisionWithImportedRoute()
		configStore := &legacy_storage.AlertmanagerConfigStoreFake{
			GetFn: func(_ context.Context, _ int64) (*legacy_storage.ConfigRevision, error) {
				return rev, nil
			},
		}
		provStore := fakes.NewFakeProvisioningStore()
		// Import is not enabled, so the fallback to imported route is not triggered.
		features := featuremgmt.WithFeatures()

		sut := createServiceSut(configStore, provStore, features, &acfakes.FakeRouteAccessService[*legacy_storage.ManagedRoute]{})

		_, err := sut.GetManagedRoute(context.Background(), orgID, "does-not-exist", user)
		require.ErrorIs(t, err, models.ErrRouteNotFound)
	})

	t.Run("returns authorization error when access is denied", func(t *testing.T) {
		configStore := &legacy_storage.AlertmanagerConfigStoreFake{}
		provStore := fakes.NewFakeProvisioningStore()
		features := featuremgmt.WithFeatures()
		sut := createServiceSut(configStore, provStore, features, acfakes.NewDenyAllRouteAccessService[*legacy_storage.ManagedRoute]())

		_, err := sut.GetManagedRoute(context.Background(), orgID, models.DefaultRoutingTreeName, user)
		require.ErrorIs(t, err, ac.ErrAuthorizationBase)
	})
}

func TestGetManagedRoutes(t *testing.T) {
	orgID := int64(1)
	usr := &user.SignedInUser{OrgID: 1}

	t.Run("returns authorization error when access is denied", func(t *testing.T) {
		rev := configRevisionWithImportedRoute()
		configStore := &legacy_storage.AlertmanagerConfigStoreFake{
			GetFn: func(_ context.Context, _ int64) (*legacy_storage.ConfigRevision, error) {
				return rev, nil
			},
		}
		provStore := fakes.NewFakeProvisioningStore()
		features := featuremgmt.WithFeatures()
		sut := createServiceSut(configStore, provStore, features, acfakes.NewDenyAllRouteAccessService[*legacy_storage.ManagedRoute]())

		_, err := sut.GetManagedRoutes(context.Background(), orgID, usr)
		require.ErrorIs(t, err, ac.ErrAuthorizationBase)
	})

	t.Run("filters out routes the user does not have access to", func(t *testing.T) {
		rev := configRevisionWithManagedRoutes()
		configStore := &legacy_storage.AlertmanagerConfigStoreFake{
			GetFn: func(_ context.Context, _ int64) (*legacy_storage.ConfigRevision, error) {
				return rev, nil
			},
		}
		provStore := fakes.NewFakeProvisioningStore()
		features := featuremgmt.WithFeatures()
		allowedNames := map[string]struct{}{
			models.DefaultRoutingTreeName: {},
			"route-a":                     {},
		}
		sut := createServiceSut(configStore, provStore, features, &acfakes.FakeRouteAccessService[*legacy_storage.ManagedRoute]{
			FilterReadFunc: func(_ context.Context, _ identity.Requester, routes ...*legacy_storage.ManagedRoute) ([]*legacy_storage.ManagedRoute, error) {
				var filtered []*legacy_storage.ManagedRoute
				for _, r := range routes {
					if _, ok := allowedNames[r.Name]; ok {
						filtered = append(filtered, r)
					}
				}
				return filtered, nil
			},
		})

		routes, err := sut.GetManagedRoutes(context.Background(), orgID, usr)
		require.NoError(t, err)

		names := make([]string, 0, len(routes))
		for _, r := range routes {
			names = append(names, r.Name)
		}
		assert.ElementsMatch(t, []string{models.DefaultRoutingTreeName, "route-a"}, names)
	})

	t.Run("returns empty list when user has no access to any route", func(t *testing.T) {
		rev := configRevisionWithManagedRoutes()
		configStore := &legacy_storage.AlertmanagerConfigStoreFake{
			GetFn: func(_ context.Context, _ int64) (*legacy_storage.ConfigRevision, error) {
				return rev, nil
			},
		}
		provStore := fakes.NewFakeProvisioningStore()
		features := featuremgmt.WithFeatures()
		sut := createServiceSut(configStore, provStore, features, &acfakes.FakeRouteAccessService[*legacy_storage.ManagedRoute]{
			FilterReadFunc: func(_ context.Context, _ identity.Requester, _ ...*legacy_storage.ManagedRoute) ([]*legacy_storage.ManagedRoute, error) {
				return nil, nil // no routes allowed
			},
		})

		routes, err := sut.GetManagedRoutes(context.Background(), orgID, usr)
		require.NoError(t, err)
		assert.Empty(t, routes)
	})

	t.Run("returns all routes when user has access to everything", func(t *testing.T) {
		rev := configRevisionWithManagedRoutes()
		configStore := &legacy_storage.AlertmanagerConfigStoreFake{
			GetFn: func(_ context.Context, _ int64) (*legacy_storage.ConfigRevision, error) {
				return rev, nil
			},
		}
		provStore := fakes.NewFakeProvisioningStore()
		features := featuremgmt.WithFeatures()
		sut := createServiceSut(configStore, provStore, features, &acfakes.FakeRouteAccessService[*legacy_storage.ManagedRoute]{})

		routes, err := sut.GetManagedRoutes(context.Background(), orgID, usr)
		require.NoError(t, err)
		// user-defined + route-a + route-b
		assert.Len(t, routes, 3)
	})
}

func TestCreateManagedRoute(t *testing.T) {
	orgID := int64(1)
	user := &user.SignedInUser{OrgID: 1}

	t.Run("returns authorization error when access is denied", func(t *testing.T) {
		configStore := &legacy_storage.AlertmanagerConfigStoreFake{}
		provStore := fakes.NewFakeProvisioningStore()
		features := featuremgmt.WithFeatures()
		sut := createServiceSut(configStore, provStore, features, acfakes.NewDenyAllRouteAccessService[*legacy_storage.ManagedRoute]())

		_, err := sut.CreateManagedRoute(context.Background(), orgID, "new-route", v1.Route{Receiver: "grafana-default"}, models.ProvenanceNone, user)
		require.ErrorIs(t, err, ac.ErrAuthorizationBase)
	})
	t.Run("sets default permissions when create", func(t *testing.T) {
		rev := configRevisionWithImportedRoute()
		configStore := &legacy_storage.AlertmanagerConfigStoreFake{
			GetFn: func(_ context.Context, _ int64) (*legacy_storage.ConfigRevision, error) {
				return rev, nil
			},
		}
		provStore := fakes.NewFakeProvisioningStore()
		features := featuremgmt.WithFeatures()
		authz := &acfakes.FakeRouteAccessService[*legacy_storage.ManagedRoute]{
			SetDefaultPermissionsFunc: func(_ context.Context, u identity.Requester, r *legacy_storage.ManagedRoute) error {
				assert.Equal(t, user, u)
				assert.Equal(t, "new-route", r.Name)
				return nil
			},
		}
		sut := createServiceSut(configStore, provStore, features, authz)

		_, err := sut.CreateManagedRoute(context.Background(), orgID, "new-route", v1.Route{Receiver: "grafana-default"}, models.ProvenanceNone, user)
		require.NoError(t, err)
		assert.Equal(t, []string{"AuthorizeCreate", "SetDefaultPermissions"}, authz.Calls.Methods())
	})
}

func TestUpdateManagedRoute(t *testing.T) {
	orgID := int64(1)
	user := &user.SignedInUser{OrgID: 1}

	t.Run("returns authorization error when access is denied", func(t *testing.T) {
		configStore := &legacy_storage.AlertmanagerConfigStoreFake{}
		provStore := fakes.NewFakeProvisioningStore()
		features := featuremgmt.WithFeatures()
		sut := createServiceSut(configStore, provStore, features, acfakes.NewDenyAllRouteAccessService[*legacy_storage.ManagedRoute]())

		_, err := sut.UpdateManagedRoute(context.Background(), orgID, models.DefaultRoutingTreeName, v1.Route{Receiver: "grafana-default"}, models.ProvenanceNone, "v1", user)
		require.ErrorIs(t, err, ac.ErrAuthorizationBase)
	})
}

func TestDeleteManagedRoute(t *testing.T) {
	orgID := int64(1)
	user := &user.SignedInUser{OrgID: 1}

	t.Run("returns authorization error when access is denied", func(t *testing.T) {
		configStore := &legacy_storage.AlertmanagerConfigStoreFake{}
		provStore := fakes.NewFakeProvisioningStore()
		features := featuremgmt.WithFeatures()
		sut := createServiceSut(configStore, provStore, features, acfakes.NewDenyAllRouteAccessService[*legacy_storage.ManagedRoute]())

		err := sut.DeleteManagedRoute(context.Background(), orgID, models.DefaultRoutingTreeName, models.ProvenanceNone, "v1", user)
		require.ErrorIs(t, err, ac.ErrAuthorizationBase)
	})

	t.Run("deletes all permissions when delete", func(t *testing.T) {
		rev := configRevisionWithManagedRoutes()
		configStore := &legacy_storage.AlertmanagerConfigStoreFake{
			GetFn: func(_ context.Context, _ int64) (*legacy_storage.ConfigRevision, error) {
				return rev, nil
			},
		}
		provStore := fakes.NewFakeProvisioningStore()
		features := featuremgmt.WithFeatures()
		authz := &acfakes.FakeRouteAccessService[*legacy_storage.ManagedRoute]{
			DeleteAllPermissionsFunc: func(_ context.Context, o int64, r *legacy_storage.ManagedRoute) error {
				assert.Equal(t, orgID, o)
				assert.Equal(t, "route-a", r.Name)
				return nil
			},
		}
		sut := createServiceSut(configStore, provStore, features, authz)

		err := sut.DeleteManagedRoute(context.Background(), orgID, "route-a", models.ProvenanceNone, "", user)
		require.NoError(t, err)
		assert.Equal(t, []string{"AuthorizeDeleteByUID", "DeleteAllPermissions"}, authz.Calls.Methods())
	})

	t.Run("does not delete permissions when reset the default route", func(t *testing.T) {
		rev := configRevisionWithManagedRoutes()
		configStore := &legacy_storage.AlertmanagerConfigStoreFake{
			GetFn: func(_ context.Context, _ int64) (*legacy_storage.ConfigRevision, error) {
				return rev, nil
			},
		}
		provStore := fakes.NewFakeProvisioningStore()
		features := featuremgmt.WithFeatures()
		authz := &acfakes.FakeRouteAccessService[*legacy_storage.ManagedRoute]{}
		sut := createServiceSut(configStore, provStore, features, authz)

		err := sut.DeleteManagedRoute(context.Background(), orgID, models.DefaultRoutingTreeName, models.ProvenanceNone, "", user)
		require.NoError(t, err)
		assert.Equal(t, []string{"AuthorizeDeleteByUID"}, authz.Calls.Methods())
	})
}

// TestManagedRouteCRUD_DefaultTreeAlias verifies the CRUD methods accept the legacy/canonical alias
// (models.DefaultRoutingTreeNameAlias, "default") as a reference to the default (root) routing tree,
// behaving exactly as they do for the emitted name (models.DefaultRoutingTreeName, "user-defined").
func TestManagedRouteCRUD_DefaultTreeAlias(t *testing.T) {
	orgID := int64(1)
	user := &user.SignedInUser{OrgID: 1}

	newSut := func(rev *legacy_storage.ConfigRevision, features featuremgmt.FeatureToggles, authz routeAccessControl) *Service {
		configStore := &legacy_storage.AlertmanagerConfigStoreFake{
			GetFn: func(_ context.Context, _ int64) (*legacy_storage.ConfigRevision, error) {
				return rev, nil
			},
		}
		return createServiceSut(configStore, fakes.NewFakeProvisioningStore(), features, authz)
	}

	t.Run("Get via alias resolves to the default route", func(t *testing.T) {
		rev := configRevisionWithManagedRoutes()
		sut := newSut(rev, featuremgmt.WithFeatures(), &acfakes.FakeRouteAccessService[*legacy_storage.ManagedRoute]{})

		route, err := sut.GetManagedRoute(context.Background(), orgID, models.DefaultRoutingTreeNameAlias, user)
		require.NoError(t, err)
		// The response echoes the requested alias, but the route resolves to the root route...
		assert.Equal(t, models.DefaultRoutingTreeNameAlias, route.Name)
		assert.Equal(t, rev.Config.AlertmanagerConfig.Route.Receiver, route.Receiver)
		// ...and its identity canonicalizes to the default tree, so RBAC scopes are stable across names.
		assert.Equal(t, models.DefaultRoutingTreeName, route.GetUID())
	})

	t.Run("Update via alias updates the root route, not a managed route", func(t *testing.T) {
		rev := configRevisionWithManagedRoutes()
		sut := newSut(rev, featuremgmt.WithFeatures(), &acfakes.FakeRouteAccessService[*legacy_storage.ManagedRoute]{})

		// Fetch the current version so the optimistic concurrency check passes.
		current, err := sut.GetManagedRoute(context.Background(), orgID, models.DefaultRoutingTreeNameAlias, user)
		require.NoError(t, err)

		updated, err := sut.UpdateManagedRoute(context.Background(), orgID, models.DefaultRoutingTreeNameAlias, v1.Route{Receiver: "empty"}, models.ProvenanceNone, current.Version, user)
		require.NoError(t, err)
		assert.Equal(t, models.DefaultRoutingTreeNameAlias, updated.Name)
		assert.Equal(t, models.DefaultRoutingTreeName, updated.GetUID())
		// The root route was modified in place; no managed route was created under the alias.
		assert.Equal(t, "empty", rev.Config.AlertmanagerConfig.Route.Receiver)
		assert.NotContains(t, rev.Config.ManagedRoutes, models.DefaultRoutingTreeNameAlias)
	})

	t.Run("Delete via alias resets the default route and does not delete permissions", func(t *testing.T) {
		rev := configRevisionWithManagedRoutes()
		authz := &acfakes.FakeRouteAccessService[*legacy_storage.ManagedRoute]{}
		sut := newSut(rev, featuremgmt.WithFeatures(), authz)

		err := sut.DeleteManagedRoute(context.Background(), orgID, models.DefaultRoutingTreeNameAlias, models.ProvenanceNone, "", user)
		require.NoError(t, err)
		// Same as deleting by the emitted name: it resets (not deletes) and keeps the route's permissions.
		assert.Equal(t, []string{"AuthorizeDeleteByUID"}, authz.Calls.Methods())
	})

	t.Run("Create with the alias is rejected as a reserved name", func(t *testing.T) {
		rev := configRevisionWithManagedRoutes()
		sut := newSut(rev, featuremgmt.WithFeatures(), &acfakes.FakeRouteAccessService[*legacy_storage.ManagedRoute]{})

		_, err := sut.CreateManagedRoute(context.Background(), orgID, models.DefaultRoutingTreeNameAlias, v1.Route{Receiver: "grafana-default"}, models.ProvenanceNone, user)
		require.ErrorIs(t, err, models.ErrRouteExists)
		assert.NotContains(t, rev.Config.ManagedRoutes, models.DefaultRoutingTreeNameAlias)
	})
}
