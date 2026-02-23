package routes

import (
	"context"
	"errors"
	"testing"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
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
) *Service {
	return &Service{
		configStore:     configStore,
		provenanceStore: provStore,
		xact:            &nopTransactionManager{},
		log:             log.NewNopLogger(),
		settings:        setting.UnifiedAlertingSettings{},
		validator: func(from, to models.Provenance) error {
			return nil
		},
		FeatureToggles: features,
		tracer:         tracing.InitializeTracerForTest(),
	}
}

func configRevisionWithImportedRoute() *legacy_storage.ConfigRevision {
	return &legacy_storage.ConfigRevision{
		Config: &definitions.PostableUserConfig{
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{Receiver: "grafana-default"},
				},
				Receivers: []*definitions.PostableApiReceiver{
					{Receiver: config.Receiver{Name: "grafana-default"}},
				},
			},
			ExtraConfigs: []definitions.ExtraConfiguration{
				{
					Identifier: "imported",
					MergeMatchers: config.Matchers{
						&labels.Matcher{Type: labels.MatchEqual, Name: "__imported", Value: "true"},
					},
					AlertmanagerConfig: importedConfigYaml,
				},
			},
		},
		ConcurrencyToken: "test-token",
	}
}

func TestGetManagedRoute(t *testing.T) {
	orgID := int64(1)

	t.Run("imported route preserves provenance and does not query provenance store", func(t *testing.T) {
		rev := configRevisionWithImportedRoute()
		configStore := &legacy_storage.AlertmanagerConfigStoreFake{
			GetFn: func(_ context.Context, _ int64) (*legacy_storage.ConfigRevision, error) {
				return rev, nil
			},
		}
		provStore := fakes.NewFakeProvisioningStore()
		features := featuremgmt.WithFeatures(
			featuremgmt.FlagAlertingMultiplePolicies,
			featuremgmt.FlagAlertingImportAlertmanagerAPI,
		)

		sut := createServiceSut(configStore, provStore, features)

		route, err := sut.GetManagedRoute(context.Background(), orgID, "imported")
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
		features := featuremgmt.WithFeatures(
			featuremgmt.FlagAlertingMultiplePolicies,
			featuremgmt.FlagAlertingImportAlertmanagerAPI,
		)

		sut := createServiceSut(configStore, provStore, features)

		route, err := sut.GetManagedRoute(context.Background(), orgID, legacy_storage.UserDefinedRoutingTreeName)
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
		features := featuremgmt.WithFeatures(
			featuremgmt.FlagAlertingMultiplePolicies,
			featuremgmt.FlagAlertingImportAlertmanagerAPI,
		)

		sut := createServiceSut(configStore, provStore, features)

		_, err := sut.GetManagedRoute(context.Background(), orgID, legacy_storage.UserDefinedRoutingTreeName)
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
		features := featuremgmt.WithFeatures(
			featuremgmt.FlagAlertingMultiplePolicies,
			featuremgmt.FlagAlertingImportAlertmanagerAPI,
		)

		sut := createServiceSut(configStore, provStore, features)

		singleRoute, err := sut.GetManagedRoute(context.Background(), orgID, "imported")
		require.NoError(t, err)

		allRoutes, err := sut.GetManagedRoutes(context.Background(), orgID)
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
		// Only enable managed routes, not import, so the fallback to imported route is not triggered.
		features := featuremgmt.WithFeatures(
			featuremgmt.FlagAlertingMultiplePolicies,
		)

		sut := createServiceSut(configStore, provStore, features)

		_, err := sut.GetManagedRoute(context.Background(), orgID, "does-not-exist")
		require.ErrorIs(t, err, models.ErrRouteNotFound)
	})
}
