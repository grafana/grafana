package provisioning

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/grafana/alerting/definition"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func TestGetPolicyTree(t *testing.T) {
	orgID := int64(1)
	rev := getDefaultConfigRevision()
	expectedRoute := *rev.Config.AlertmanagerConfig.Route
	expectedRoute.Provenance = definitions.Provenance(models.ProvenanceAPI)
	expectedVersion := calculateRouteFingerprint(expectedRoute)

	sut, store, prov := createNotificationPolicyServiceSut()
	store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
		return &rev, nil
	}
	prov.GetProvenanceFunc = func(ctx context.Context, o models.Provisionable, org int64) (models.Provenance, error) {
		return models.ProvenanceAPI, nil
	}

	tree, version, err := sut.GetPolicyTree(context.Background(), orgID)
	require.NoError(t, err)

	assert.Equal(t, expectedRoute, tree)
	assert.Equal(t, expectedVersion, version)
	assert.Equal(t, expectedRoute.Provenance, tree.Provenance)

	assert.Len(t, store.Calls, 1)
	assert.Equal(t, "Get", store.Calls[0].Method)
	assert.Equal(t, orgID, store.Calls[0].Args[1])

	assert.Len(t, prov.Calls, 1)
	assert.Equal(t, "GetProvenance", prov.Calls[0].MethodName)
	assert.IsType(t, &definitions.Route{}, prov.Calls[0].Arguments[1])
	assert.Equal(t, orgID, prov.Calls[0].Arguments[2])
}

func TestUpdatePolicyTree(t *testing.T) {
	orgID := int64(1)
	rev := getDefaultConfigRevision()

	defaultVersion := calculateRouteFingerprint(*rev.Config.AlertmanagerConfig.Route)

	newRoute := definitions.Route{
		Receiver: rev.Config.AlertmanagerConfig.Receivers[0].Name,
		Routes: []*definitions.Route{
			{
				Receiver: "",
				MuteTimeIntervals: []string{
					rev.Config.AlertmanagerConfig.TimeIntervals[0].Name,
				},
			},
			{
				Receiver: rev.Config.AlertmanagerConfig.Receivers[0].Name,
			},
		},
	}

	t.Run("ErrValidation if referenced mute time interval does not exist", func(t *testing.T) {
		sut, store, _ := createNotificationPolicyServiceSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &rev, nil
		}
		newRoute := definitions.Route{
			Receiver: rev.Config.AlertmanagerConfig.Receivers[0].Name,
			MuteTimeIntervals: []string{
				"not-existing",
			},
		}
		_, _, err := sut.UpdatePolicyTree(context.Background(), orgID, newRoute, models.ProvenanceNone, defaultVersion)
		require.ErrorIs(t, err, ErrRouteInvalidFormat)
	})

	t.Run("ErrValidation if root route has no receiver", func(t *testing.T) {
		rev := getDefaultConfigRevision()
		sut, store, _ := createNotificationPolicyServiceSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &rev, nil
		}
		newRoute := definitions.Route{
			Receiver: "",
		}
		_, _, err := sut.UpdatePolicyTree(context.Background(), orgID, newRoute, models.ProvenanceNone, defaultVersion)
		require.ErrorIs(t, err, ErrRouteInvalidFormat)
	})

	t.Run("ErrValidation if referenced receiver does not exist", func(t *testing.T) {
		rev := getDefaultConfigRevision()
		sut, store, prov := createNotificationPolicyServiceSut()
		prov.GetProvenanceFunc = func(ctx context.Context, o models.Provisionable, org int64) (models.Provenance, error) {
			return models.ProvenanceNone, nil
		}
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &rev, nil
		}
		newRoute := definitions.Route{
			Receiver: "unknown",
		}
		_, _, err := sut.UpdatePolicyTree(context.Background(), orgID, newRoute, models.ProvenanceNone, defaultVersion)
		require.ErrorIs(t, err, ErrRouteInvalidFormat)

		t.Run("including sub-routes", func(t *testing.T) {
			newRoute := definitions.Route{
				Receiver: rev.Config.AlertmanagerConfig.Receivers[0].Name,
				Routes: []*definitions.Route{
					{Receiver: "unknown"},
				},
			}
			_, _, err := sut.UpdatePolicyTree(context.Background(), orgID, newRoute, models.ProvenanceNone, defaultVersion)
			require.ErrorIs(t, err, ErrRouteInvalidFormat)
		})
	})

	t.Run("ErrVersionConflict if provided version does not match current", func(t *testing.T) {
		rev := getDefaultConfigRevision()
		sut, store, _ := createNotificationPolicyServiceSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &rev, nil
		}
		newRoute := definitions.Route{
			Receiver: rev.Config.AlertmanagerConfig.Receivers[0].Name,
		}
		_, _, err := sut.UpdatePolicyTree(context.Background(), orgID, newRoute, models.ProvenanceNone, "wrong-version")
		require.ErrorIs(t, err, ErrVersionConflict)
	})

	t.Run("Error if provenance validation fails", func(t *testing.T) {
		sut, store, prov := createNotificationPolicyServiceSut()
		prov.GetProvenanceFunc = func(ctx context.Context, o models.Provisionable, org int64) (models.Provenance, error) {
			return models.ProvenanceAPI, nil
		}
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &rev, nil
		}
		expectedRev := getDefaultConfigRevision()
		route := newRoute
		expectedRev.ConcurrencyToken = rev.ConcurrencyToken
		expectedRev.Config.AlertmanagerConfig.Route = &route

		expectedErr := errors.New("test")
		sut.validator = func(from, to models.Provenance) error {
			assert.Equal(t, models.ProvenanceAPI, from)
			assert.Equal(t, models.ProvenanceNone, to)
			return expectedErr
		}

		_, _, err := sut.UpdatePolicyTree(context.Background(), orgID, newRoute, models.ProvenanceNone, defaultVersion)
		require.ErrorIs(t, err, expectedErr)

		assert.Len(t, prov.Calls, 1)
		assert.Equal(t, "GetProvenance", prov.Calls[0].MethodName)
		assert.IsType(t, &definitions.Route{}, prov.Calls[0].Arguments[1])
		assert.Equal(t, orgID, prov.Calls[0].Arguments[2].(int64))
	})

	t.Run("updates Route and sets provenance in transaction if route is valid and version matches", func(t *testing.T) {
		sut, store, prov := createNotificationPolicyServiceSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &rev, nil
		}
		expectedRev := getDefaultConfigRevision()
		route := newRoute
		expectedRev.ConcurrencyToken = rev.ConcurrencyToken
		expectedRev.Config.AlertmanagerConfig.Route = &route

		result, version, err := sut.UpdatePolicyTree(context.Background(), orgID, newRoute, models.ProvenanceAPI, defaultVersion)
		require.NoError(t, err)
		assert.Equal(t, newRoute, result)
		assert.Equal(t, calculateRouteFingerprint(newRoute), version)

		assert.Len(t, store.Calls, 2)
		assert.Equal(t, "Save", store.Calls[1].Method)
		assertInTransaction(t, store.Calls[1].Args[0].(context.Context))
		assert.Equal(t, &expectedRev, store.Calls[1].Args[1])

		c := prov.Calls[0]
		assert.Equal(t, "GetProvenance", c.MethodName)
		assert.IsType(t, &definitions.Route{}, c.Arguments[1])
		assert.Equal(t, orgID, c.Arguments[2].(int64))
		c = prov.Calls[1]
		assert.Equal(t, "SetProvenance", c.MethodName)
		assertInTransaction(t, c.Arguments[0].(context.Context))
		assert.IsType(t, &definitions.Route{}, c.Arguments[1])
		assert.Equal(t, orgID, c.Arguments[2].(int64))
		assert.Equal(t, models.ProvenanceAPI, c.Arguments[3].(models.Provenance))
	})

	t.Run("bypasses optimistic concurrency if provided version is empty", func(t *testing.T) {
		sut, store, prov := createNotificationPolicyServiceSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &rev, nil
		}

		expectedRev := getDefaultConfigRevision()
		expectedRev.Config.AlertmanagerConfig.Route = &newRoute
		expectedRev.ConcurrencyToken = rev.ConcurrencyToken

		result, version, err := sut.UpdatePolicyTree(context.Background(), orgID, newRoute, models.ProvenanceAPI, "")
		require.NoError(t, err)
		assert.Equal(t, newRoute, result)
		assert.Equal(t, calculateRouteFingerprint(newRoute), version)

		assert.Len(t, store.Calls, 2)
		assert.Equal(t, "Save", store.Calls[1].Method)
		assertInTransaction(t, store.Calls[1].Args[0].(context.Context))
		assert.Equal(t, &expectedRev, store.Calls[1].Args[1])

		assert.Len(t, prov.Calls, 2)
		c := prov.Calls[1]
		assert.Equal(t, "SetProvenance", c.MethodName)
		assertInTransaction(t, c.Arguments[0].(context.Context))
		assert.IsType(t, &definitions.Route{}, c.Arguments[1])
		assert.Equal(t, orgID, c.Arguments[2].(int64))
		assert.Equal(t, models.ProvenanceAPI, c.Arguments[3].(models.Provenance))
	})
}

func TestResetPolicyTree(t *testing.T) {
	orgID := int64(1)

	currentRevision := getDefaultConfigRevision()
	currentRevision.Config.AlertmanagerConfig.Route = &definitions.Route{
		Receiver: "receiver",
	}
	currentRevision.Config.TemplateFiles = map[string]string{
		"test": "test",
	}
	currentRevision.Config.AlertmanagerConfig.TimeIntervals = []config.TimeInterval{
		{
			Name: "test",
		},
	}
	currentRevision.Config.AlertmanagerConfig.Receivers = []*definitions.PostableApiReceiver{
		{
			Receiver: config.Receiver{Name: "receiver"},
			PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
				GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
					{
						UID: "test", Name: "test", Type: "email", Settings: []byte("{}"),
					},
				},
			},
		},
	}

	t.Run("Error if default config is invalid", func(t *testing.T) {
		sut, _, _ := createNotificationPolicyServiceSut()
		sut.settings = setting.UnifiedAlertingSettings{
			DefaultConfiguration: "{",
		}
		_, err := sut.ResetPolicyTree(context.Background(), orgID, models.ProvenanceNone)
		require.ErrorContains(t, err, "failed to parse default alertmanager config")
	})

	t.Run("Error if provenance validation fails", func(t *testing.T) {
		sut, _, prov := createNotificationPolicyServiceSut()
		prov.GetProvenanceFunc = func(ctx context.Context, o models.Provisionable, org int64) (models.Provenance, error) {
			return models.ProvenanceAPI, nil
		}

		expectedErr := errors.New("test")
		sut.validator = func(from, to models.Provenance) error {
			assert.Equal(t, models.ProvenanceAPI, from)
			assert.Equal(t, models.ProvenanceNone, to)
			return expectedErr
		}

		_, err := sut.ResetPolicyTree(context.Background(), orgID, models.ProvenanceNone)
		require.ErrorIs(t, err, expectedErr)
	})

	t.Run("replaces route with one from the default config and copies receivers if do not exist", func(t *testing.T) {
		defaultConfig := getDefaultConfigRevision().Config
		data, err := legacy_storage.SerializeAlertmanagerConfig(*defaultConfig)
		require.NoError(t, err)

		sut, store, prov := createNotificationPolicyServiceSut()
		sut.settings = setting.UnifiedAlertingSettings{
			DefaultConfiguration: string(data),
		}

		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			data, err := legacy_storage.SerializeAlertmanagerConfig(*currentRevision.Config)
			require.NoError(t, err)
			cfg, err := legacy_storage.DeserializeAlertmanagerConfig(data)
			require.NoError(t, err)
			return &legacy_storage.ConfigRevision{
				Config:           cfg,
				ConcurrencyToken: util.GenerateShortUID(),
			}, nil
		}

		expectedRev := currentRevision
		expectedRev.Config.AlertmanagerConfig.Route = getDefaultConfigRevision().Config.AlertmanagerConfig.Route
		expectedRev.Config.AlertmanagerConfig.Receivers = append(expectedRev.Config.AlertmanagerConfig.Receivers, getDefaultConfigRevision().Config.AlertmanagerConfig.Receivers[0])

		tree, err := sut.ResetPolicyTree(context.Background(), orgID, models.ProvenanceNone)
		require.NoError(t, err)
		assert.Equal(t, *defaultConfig.AlertmanagerConfig.Route, tree)

		assert.Len(t, store.Calls, 2)
		assert.Equal(t, "Save", store.Calls[1].Method)
		assertInTransaction(t, store.Calls[1].Args[0].(context.Context))
		resetRev := store.Calls[1].Args[1].(*legacy_storage.ConfigRevision)
		assert.Equal(t, expectedRev.Config.AlertmanagerConfig, resetRev.Config.AlertmanagerConfig)

		assert.Len(t, prov.Calls, 2)
		c := prov.Calls[0]
		assert.Equal(t, "GetProvenance", c.MethodName)
		assert.IsType(t, &definitions.Route{}, c.Arguments[1])
		assert.Equal(t, orgID, c.Arguments[2].(int64))
		c = prov.Calls[1]
		assert.Equal(t, "DeleteProvenance", c.MethodName)
		assertInTransaction(t, c.Arguments[0].(context.Context))
		assert.IsType(t, &definitions.Route{}, c.Arguments[1])
		assert.Equal(t, orgID, c.Arguments[2])
	})
}

func TestRoute_Fingerprint(t *testing.T) {
	// Test that the fingerprint is stable.
	mustRegex := func(rg string) config.Regexp {
		var regex config.Regexp
		require.NoError(t, json.Unmarshal([]byte(rg), &regex))
		return regex
	}
	mustMatcher := func(t *testing.T, mt labels.MatchType, lbl, val string) *labels.Matcher {
		m, err := labels.NewMatcher(mt, lbl, val)
		require.NoError(t, err)
		return m
	}
	baseRouteGen := func() definitions.Route {
		return definitions.Route{
			Receiver:   "Receiver",
			GroupByStr: []string{"GroupByStr1", "GroupByStr2"},
			GroupBy: []model.LabelName{
				"...",
			},
			GroupByAll: true,
			Match:      map[string]string{"Match1": "MatchValue1", "Match2": "MatchValue2"},
			MatchRE: map[string]config.Regexp{
				"MatchRE": mustRegex(`".*"`),
			},
			Matchers: config.Matchers{
				mustMatcher(t, labels.MatchNotEqual, "Matchers1", "Matchers1Value"),
				mustMatcher(t, labels.MatchEqual, "Matchers2", "Matchers2Value"),
				mustMatcher(t, labels.MatchRegexp, "Matchers3", "Matchers3Value"),
			},
			ObjectMatchers: definitions.ObjectMatchers{
				mustMatcher(t, labels.MatchNotRegexp, "ObjectMatchers1", "ObjectMatchers1Value"),
				mustMatcher(t, labels.MatchRegexp, "ObjectMatchers2", "ObjectMatchers2Value"),
			},
			MuteTimeIntervals:   []string{"MuteTimeIntervals1", "MuteTimeIntervals2"},
			ActiveTimeIntervals: []string{"ActiveTimeIntervals1", "ActiveTimeIntervals2"},
			Continue:            true,
			GroupWait:           util.Pointer(model.Duration(2 * time.Minute)),
			GroupInterval:       util.Pointer(model.Duration(5 * time.Minute)),
			RepeatInterval:      util.Pointer(model.Duration(30 * time.Hour)),
			Provenance:          definitions.Provenance(models.ProvenanceAPI),
			Routes:              nil, // Nested routes are not included in the fingerprint test for simplicity.
		}
	}

	completelyDifferentRoute := definitions.Route{
		Receiver:   "Receiver_2",
		GroupByStr: []string{"GroupByStr1_2", "GroupByStr2_2"},
		GroupBy: []model.LabelName{
			"other",
		},
		GroupByAll: false,
		Match:      map[string]string{"Match1_2": "MatchValue1", "Match2": "MatchValue2_2"},
		MatchRE: map[string]config.Regexp{
			"MatchRE": mustRegex(`".+"`),
		},
		Matchers: config.Matchers{
			mustMatcher(t, labels.MatchNotEqual, "Matchers1_2", "Matchers1Value"),
			mustMatcher(t, labels.MatchEqual, "Matchers2", "Matchers2Value_2"),
			mustMatcher(t, labels.MatchEqual, "Matchers3", "Matchers3Value"),
		},
		ObjectMatchers: definitions.ObjectMatchers{
			mustMatcher(t, labels.MatchNotRegexp, "ObjectMatchers1_2", "ObjectMatchers1Value"),
			mustMatcher(t, labels.MatchRegexp, "ObjectMatchers2", "ObjectMatchers2Value_2"),
		},
		MuteTimeIntervals:   []string{"MuteTimeIntervals1_2", "MuteTimeIntervals2_2"},
		ActiveTimeIntervals: []string{"ActiveTimeIntervals1_2", "ActiveTimeIntervals2_2"},
		Continue:            false,
		GroupWait:           util.Pointer(model.Duration(20 * time.Minute)),
		GroupInterval:       util.Pointer(model.Duration(50 * time.Minute)),
		RepeatInterval:      util.Pointer(model.Duration(300 * time.Hour)),
		Provenance:          definitions.Provenance(models.ProvenanceFile),
		Routes:              nil, // Nested routes are not included in the fingerprint test for simplicity, recursive fingerprinting is assumed.
	}

	t.Run("stable across code changes", func(t *testing.T) {
		expectedFingerprint := "7faba12778df93b8" // If this is a valid fingerprint generation change, update the expected value.
		assert.Equal(t, expectedFingerprint, calculateRouteFingerprint(baseRouteGen()))
	})
	t.Run("unstable across field modification", func(t *testing.T) {
		fingerprint := calculateRouteFingerprint(baseRouteGen())
		excludedFields := map[string]struct{}{
			"Routes": {},
		}

		reflectVal := reflect.ValueOf(&completelyDifferentRoute).Elem()

		receiverType := reflect.TypeOf((*definitions.Route)(nil)).Elem()
		for i := 0; i < receiverType.NumField(); i++ {
			field := receiverType.Field(i).Name
			if _, ok := excludedFields[field]; ok {
				continue
			}
			cp := baseRouteGen()

			// Get the current field being modified.
			v := reflect.ValueOf(&cp).Elem()
			vf := v.Field(i)

			otherField := reflectVal.Field(i)
			if reflect.DeepEqual(otherField.Interface(), vf.Interface()) {
				assert.Failf(t, "fields are identical", "Route field %s is the same as the original, test does not ensure instability across the field", field)
				continue
			}

			// Set the field to the value of the completelyDifferentRoute.
			vf.Set(otherField)

			f2 := calculateRouteFingerprint(cp)
			assert.NotEqualf(t, fingerprint, f2, "Route field %s does not seem to be used in fingerprint", field)
		}
	})
}

func createNotificationPolicyServiceSut() (*NotificationPolicyService, *legacy_storage.AlertmanagerConfigStoreFake, *fakes.FakeProvisioningStore) {
	prov := fakes.NewFakeProvisioningStore()
	configStore := &legacy_storage.AlertmanagerConfigStoreFake{
		GetFn: func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			rev := getDefaultConfigRevision()
			return &rev, nil
		},
	}
	return &NotificationPolicyService{
		configStore:     configStore,
		provenanceStore: prov,
		xact:            newNopTransactionManager(),
		log:             log.NewNopLogger(),
		settings: setting.UnifiedAlertingSettings{
			DefaultConfiguration: setting.GetAlertmanagerDefaultConfiguration(),
		},
		validator: func(from, to models.Provenance) error {
			return nil
		},
	}, configStore, prov
}

func getDefaultConfigRevision() legacy_storage.ConfigRevision {
	return legacy_storage.ConfigRevision{
		Config: &definitions.PostableUserConfig{
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definition.Config{
					Route: &definitions.Route{
						Receiver: "test-receiver",
					},
					InhibitRules: nil,
					TimeIntervals: []config.TimeInterval{
						{
							Name: "test-mute-interval",
						},
					},
				},
				Receivers: []*definitions.PostableApiReceiver{
					{
						Receiver: config.Receiver{
							Name: "test-receiver",
						},
					},
				},
			},
		},
		ConcurrencyToken: util.GenerateShortUID(),
	}
}
