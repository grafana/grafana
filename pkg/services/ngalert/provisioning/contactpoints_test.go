package provisioning

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"testing"

	"github.com/grafana/alerting/notify"
	"github.com/prometheus/alertmanager/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/exp/maps"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	ac "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels_config"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	"github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

func TestContactPointService(t *testing.T) {
	sqlStore := db.InitTestDB(t)
	secretsService := manager.SetupTestService(t, database.ProvideSecretsStore(sqlStore))

	redactedUser := &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
		1: {
			accesscontrol.ActionAlertingProvisioningRead: nil,
		},
	}}
	decryptedUser := &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
		1: {
			accesscontrol.ActionAlertingProvisioningReadSecrets: nil,
		},
	}}

	t.Run("service gets contact points from AM config", func(t *testing.T) {
		sut := createContactPointServiceSut(t, secretsService)

		cps, err := sut.GetContactPoints(context.Background(), cpsQuery(1), redactedUser)
		require.NoError(t, err)

		require.Len(t, cps, 2)
		require.Equal(t, "grafana-default-email", cps[0].Name)
		require.Equal(t, "slack receiver", cps[1].Name)
	})

	t.Run("service filters contact points by name", func(t *testing.T) {
		sut := createContactPointServiceSut(t, secretsService)

		cps, err := sut.GetContactPoints(context.Background(), cpsQueryWithName(1, "slack receiver"), redactedUser)
		require.NoError(t, err)

		require.Len(t, cps, 1)
		require.Equal(t, "slack receiver", cps[0].Name)
	})

	t.Run("service filters contact points by name, returns empty when no match", func(t *testing.T) {
		sut := createContactPointServiceSut(t, secretsService)

		cps, err := sut.GetContactPoints(context.Background(), cpsQueryWithName(1, "unknown"), redactedUser)
		require.NoError(t, err)

		require.Len(t, cps, 0)
	})

	t.Run("service stitches contact point into org's AM config", func(t *testing.T) {
		sut := createContactPointServiceSut(t, secretsService)
		newCp := createTestContactPoint()

		_, err := sut.CreateContactPoint(context.Background(), 1, redactedUser, newCp, models.ProvenanceAPI)
		require.NoError(t, err)

		cps, err := sut.GetContactPoints(context.Background(), cpsQuery(1), redactedUser)
		require.NoError(t, err)
		require.Len(t, cps, 3)
		require.Equal(t, "test-contact-point", cps[2].Name)
		require.Equal(t, "slack", cps[2].Type)
	})

	t.Run("it's possible to use a custom uid", func(t *testing.T) {
		customUID := "1337"
		sut := createContactPointServiceSut(t, secretsService)
		newCp := createTestContactPoint()
		newCp.UID = customUID

		_, err := sut.CreateContactPoint(context.Background(), 1, redactedUser, newCp, models.ProvenanceAPI)
		require.NoError(t, err)

		cps, err := sut.GetContactPoints(context.Background(), cpsQueryWithName(1, newCp.Name), redactedUser)
		require.NoError(t, err)
		require.Len(t, cps, 1)
		require.Equal(t, customUID, cps[0].UID)
	})

	t.Run("it's not possible to use invalid UID", func(t *testing.T) {
		customUID := strings.Repeat("1", util.MaxUIDLength+1)
		sut := createContactPointServiceSut(t, secretsService)
		newCp := createTestContactPoint()
		newCp.UID = customUID

		_, err := sut.CreateContactPoint(context.Background(), 1, redactedUser, newCp, models.ProvenanceAPI)
		require.ErrorIs(t, err, ErrValidation)
	})

	t.Run("it's not possible to use the same uid twice", func(t *testing.T) {
		customUID := "1337"
		sut := createContactPointServiceSut(t, secretsService)
		newCp := createTestContactPoint()
		newCp.UID = customUID

		_, err := sut.CreateContactPoint(context.Background(), 1, redactedUser, newCp, models.ProvenanceAPI)
		require.NoError(t, err)

		_, err = sut.CreateContactPoint(context.Background(), 1, redactedUser, newCp, models.ProvenanceAPI)
		require.Error(t, err)
	})

	t.Run("create rejects contact points that fail validation", func(t *testing.T) {
		sut := createContactPointServiceSut(t, secretsService)
		newCp := createTestContactPoint()
		newCp.Type = ""

		_, err := sut.CreateContactPoint(context.Background(), 1, redactedUser, newCp, models.ProvenanceAPI)

		require.ErrorIs(t, err, ErrValidation)
	})

	t.Run("update rejects contact points with no settings", func(t *testing.T) {
		sut := createContactPointServiceSut(t, secretsService)
		newCp := createTestContactPoint()
		newCp, err := sut.CreateContactPoint(context.Background(), 1, redactedUser, newCp, models.ProvenanceAPI)
		require.NoError(t, err)
		newCp.Settings = nil

		err = sut.UpdateContactPoint(context.Background(), 1, newCp, models.ProvenanceAPI)

		require.ErrorIs(t, err, ErrValidation)
	})

	t.Run("update rejects contact points with no type", func(t *testing.T) {
		sut := createContactPointServiceSut(t, secretsService)
		newCp := createTestContactPoint()
		newCp, err := sut.CreateContactPoint(context.Background(), 1, redactedUser, newCp, models.ProvenanceAPI)
		require.NoError(t, err)
		newCp.Type = ""

		err = sut.UpdateContactPoint(context.Background(), 1, newCp, models.ProvenanceAPI)

		require.ErrorIs(t, err, ErrValidation)
	})

	t.Run("update rejects contact points which fail validation after merging", func(t *testing.T) {
		sut := createContactPointServiceSut(t, secretsService)
		newCp := createTestContactPoint()
		newCp, err := sut.CreateContactPoint(context.Background(), 1, redactedUser, newCp, models.ProvenanceAPI)
		require.NoError(t, err)
		newCp.Settings, _ = simplejson.NewJson([]byte(`{}`))

		err = sut.UpdateContactPoint(context.Background(), 1, newCp, models.ProvenanceAPI)

		require.ErrorIs(t, err, ErrValidation)
	})

	t.Run("update renames references when group is renamed", func(t *testing.T) {
		cfg := createEncryptedConfig(t, secretsService)
		store := fakes.NewFakeAlertmanagerConfigStore(cfg)
		sut := createContactPointServiceSutWithConfigStore(t, secretsService, store)

		svc := &fakeReceiverService{}
		sut.receiverService = svc

		newCp := createTestContactPoint()
		oldName := newCp.Name
		newName := "new-name"

		newCp, err := sut.CreateContactPoint(context.Background(), 1, redactedUser, newCp, models.ProvenanceAPI)
		require.NoError(t, err)

		newCp.Name = newName

		svc.RenameReceiverInDependentResourcesFunc = func(ctx context.Context, orgID int64, route *definitions.Route, oldName, newName string, receiverProvenance models.Provenance) error {
			legacy_storage.RenameReceiverInRoute(oldName, newName, route)
			return nil
		}

		err = sut.UpdateContactPoint(context.Background(), 1, newCp, models.ProvenanceAPI)
		require.NoError(t, err)

		parsed, err := legacy_storage.DeserializeAlertmanagerConfig([]byte(store.LastSaveCommand.AlertmanagerConfiguration))
		require.NoError(t, err)

		require.Lenf(t, svc.Calls, 1, "service was supposed to be called once")
		assert.Equal(t, "RenameReceiverInDependentResources", svc.Calls[0].Method)
		assertInTransaction(t, svc.Calls[0].Args[0].(context.Context))
		assert.Equal(t, int64(1), svc.Calls[0].Args[1])
		assert.EqualValues(t, parsed.AlertmanagerConfig.Route, svc.Calls[0].Args[2])
		assert.Equal(t, oldName, svc.Calls[0].Args[3])
		assert.Equal(t, newName, svc.Calls[0].Args[4])
		assert.Equal(t, models.ProvenanceAPI, svc.Calls[0].Args[5])
	})

	t.Run("default provenance of contact points is none", func(t *testing.T) {
		sut := createContactPointServiceSut(t, secretsService)

		cps, err := sut.GetContactPoints(context.Background(), cpsQuery(1), redactedUser)
		require.NoError(t, err)

		require.Equal(t, models.ProvenanceNone, models.Provenance(cps[0].Provenance))
	})

	t.Run("contact point provenance should be correctly checked", func(t *testing.T) {
		tests := []struct {
			name   string
			from   models.Provenance
			to     models.Provenance
			errNil bool
		}{
			{
				name:   "should be able to update from provenance none to api",
				from:   models.ProvenanceNone,
				to:     models.ProvenanceAPI,
				errNil: true,
			},
			{
				name:   "should be able to update from provenance none to file",
				from:   models.ProvenanceNone,
				to:     models.ProvenanceFile,
				errNil: true,
			},
			{
				name:   "should not be able to update from provenance api to file",
				from:   models.ProvenanceAPI,
				to:     models.ProvenanceFile,
				errNil: false,
			},
			{
				name:   "should not be able to update from provenance api to none",
				from:   models.ProvenanceAPI,
				to:     models.ProvenanceNone,
				errNil: false,
			},
			{
				name:   "should not be able to update from provenance file to api",
				from:   models.ProvenanceFile,
				to:     models.ProvenanceAPI,
				errNil: false,
			},
			{
				name:   "should not be able to update from provenance file to none",
				from:   models.ProvenanceFile,
				to:     models.ProvenanceNone,
				errNil: false,
			},
		}
		for _, test := range tests {
			t.Run(test.name, func(t *testing.T) {
				sut := createContactPointServiceSut(t, secretsService)
				newCp := createTestContactPoint()

				newCp, err := sut.CreateContactPoint(context.Background(), 1, redactedUser, newCp, test.from)
				require.NoError(t, err)

				cps, err := sut.GetContactPoints(context.Background(), cpsQueryWithName(1, newCp.Name), redactedUser)
				require.NoError(t, err)
				require.Equal(t, newCp.UID, cps[0].UID)
				require.Equal(t, test.from, models.Provenance(cps[0].Provenance))

				err = sut.UpdateContactPoint(context.Background(), 1, newCp, test.to)
				if test.errNil {
					require.NoError(t, err)

					cps, err = sut.GetContactPoints(context.Background(), cpsQueryWithName(1, newCp.Name), redactedUser)
					require.NoError(t, err)
					require.Equal(t, newCp.UID, cps[0].UID)
					require.Equal(t, test.to, models.Provenance(cps[0].Provenance))
				} else {
					require.Error(t, err, fmt.Sprintf("cannot change provenance from '%s' to '%s'", test.from, test.to))
				}
			})
		}
	})

	t.Run("service respects concurrency token when updating", func(t *testing.T) {
		cfg := createEncryptedConfig(t, secretsService)
		fakeConfigStore := fakes.NewFakeAlertmanagerConfigStore(cfg)
		sut := createContactPointServiceSutWithConfigStore(t, secretsService, fakeConfigStore)
		newCp := createTestContactPoint()
		config, err := sut.configStore.Get(context.Background(), 1)
		require.NoError(t, err)
		expectedConcurrencyToken := config.ConcurrencyToken

		_, err = sut.CreateContactPoint(context.Background(), 1, redactedUser, newCp, models.ProvenanceAPI)
		require.NoError(t, err)

		intercepted := fakeConfigStore.LastSaveCommand
		require.Equal(t, expectedConcurrencyToken, intercepted.FetchedConfigurationHash)
	})

	t.Run("secrets are parsed in a case-insensitive way", func(t *testing.T) {
		// JSON unmarshalling is case-insensitive. This means we can have
		// a setting named "TOKEN" instead of "token". This test ensures that
		// we handle such cases correctly and the token value is properly parsed,
		// even if the setting key does not match the JSON key exactly.
		tests := []struct {
			settingsJSON  string
			expectedValue string
			name          string
		}{
			{
				settingsJSON:  `{"recipient":"value_recipient","TOKEN":"some-other-token"}`,
				expectedValue: "some-other-token",
				name:          "token key is uppercased",
			},

			// This test checks that if multiple token keys are present in the settings,
			// the key with the exact matching name is used.
			{
				settingsJSON:  `{"recipient":"value_recipient","TOKEN":"some-other-token", "token": "second-token"}`,
				expectedValue: "second-token",
				name:          "multiple token keys",
			},
		}

		for _, tc := range tests {
			t.Run(tc.name, func(t *testing.T) {
				sut := createContactPointServiceSut(t, secretsService)

				newCp := createTestContactPoint()
				settings, _ := simplejson.NewJson([]byte(tc.settingsJSON))
				newCp.Settings = settings

				_, err := sut.CreateContactPoint(context.Background(), 1, redactedUser, newCp, models.ProvenanceAPI)
				require.NoError(t, err)

				q := cpsQueryWithName(1, newCp.Name)
				q.Decrypt = true
				cps, err := sut.GetContactPoints(context.Background(), q, decryptedUser)
				require.NoError(t, err)
				require.Len(t, cps, 1)
				require.Equal(t, tc.expectedValue, cps[0].Settings.Get("token").MustString())
			})
		}
	})
}

func TestContactPointServiceDecryptRedact(t *testing.T) {
	secretsService := manager.SetupTestService(t, database.ProvideSecretsStore(db.InitTestDB(t)))

	redactedUser := &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
		1: {
			accesscontrol.ActionAlertingProvisioningRead: nil,
		},
	}}

	decryptedUser := &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
		1: {
			accesscontrol.ActionAlertingProvisioningReadSecrets: nil,
		},
	}}

	t.Run("GetContactPoints gets redacted contact points by default", func(t *testing.T) {
		sut := createContactPointServiceSut(t, secretsService)

		cps, err := sut.GetContactPoints(context.Background(), cpsQuery(1), redactedUser)
		require.NoError(t, err)

		require.Len(t, cps, 2)
		require.Equal(t, "slack receiver", cps[1].Name)
		require.Equal(t, definitions.RedactedValue, cps[1].Settings.Get("url").MustString())
	})

	t.Run("GetContactPoints errors when Decrypt = true and user does not have permissions", func(t *testing.T) {
		sut := createContactPointServiceSut(t, secretsService)

		q := cpsQuery(1)
		q.Decrypt = true
		_, err := sut.GetContactPoints(context.Background(), q, redactedUser)
		require.ErrorIs(t, err, ac.ErrAuthorizationBase)
	})
	t.Run("GetContactPoints errors when Decrypt = true and user is nil", func(t *testing.T) {
		sut := createContactPointServiceSut(t, secretsService)

		q := cpsQuery(1)
		q.Decrypt = true
		_, err := sut.GetContactPoints(context.Background(), q, nil)
		require.ErrorIs(t, err, ac.ErrAuthorizationBase)
	})

	t.Run("GetContactPoints gets decrypted contact points when Decrypt = true and user has permissions", func(t *testing.T) {
		sut := createContactPointServiceSut(t, secretsService)

		expectedName := "slack receiver"
		q := cpsQueryWithName(1, expectedName)
		q.Decrypt = true
		cps, err := sut.GetContactPoints(context.Background(), q, decryptedUser)
		require.NoError(t, err)

		require.Len(t, cps, 1)
		require.Equal(t, expectedName, cps[0].Name)
		require.Equal(t, "secure url", cps[0].Settings.Get("url").MustString())
	})
}

func TestRemoveSecretsForContactPoint(t *testing.T) {
	overrides := map[string]func(settings map[string]any){
		"webhook": func(settings map[string]any) { // add additional field to the settings because valid config does not allow it to be specified along with password
			settings["authorization_credentials"] = "test-authz-creds"
		},
		"jira": func(settings map[string]any) { // add additional field to the settings because valid config does not allow it to be specified along with password
			settings["api_token"] = "test-token"
		},
	}

	configs := notify.AllKnownConfigsForTesting
	keys := maps.Keys(configs)
	slices.Sort(keys)
	for _, integrationType := range keys {
		cfg := configs[integrationType]
		var settings map[string]any
		require.NoError(t, json.Unmarshal([]byte(cfg.Config), &settings))
		if f, ok := overrides[integrationType]; ok {
			f(settings)
		}
		settingsRaw, err := json.Marshal(settings)
		require.NoError(t, err)

		expectedFields, err := channels_config.GetSecretKeysForContactPointType(integrationType)
		require.NoError(t, err)

		t.Run(integrationType, func(t *testing.T) {
			cp := definitions.EmbeddedContactPoint{
				Name:     "integration-" + integrationType,
				Type:     integrationType,
				Settings: simplejson.MustJson(settingsRaw),
			}
			secureFields, err := RemoveSecretsForContactPoint(&cp)
			require.NoError(t, err)

		FIELDS_ASSERT:
			for _, field := range expectedFields {
				assert.Contains(t, secureFields, field)
				path := strings.Split(field, ".")
				var expectedValue any = settings
				for _, segment := range path {
					v, ok := expectedValue.(map[string]any)
					if !ok {
						assert.Fail(t, fmt.Sprintf("cannot get expected value for field '%s'", field))
						continue FIELDS_ASSERT
					}
					expectedValue = v[segment]
				}
				assert.EqualValues(t, secureFields[field], expectedValue)
				v, err := cp.Settings.GetPath(path...).Value()
				assert.NoError(t, err)
				assert.Nilf(t, v, "field %s is expected to be removed from the settings", field)
			}
		})
	}
}

func createContactPointServiceSut(t *testing.T, secretService secrets.Service) *ContactPointService {
	// Encrypt secure settings.
	cfg := createEncryptedConfig(t, secretService)
	store := fakes.NewFakeAlertmanagerConfigStore(cfg)
	return createContactPointServiceSutWithConfigStore(t, secretService, store)
}

func createContactPointServiceSutWithConfigStore(t *testing.T, secretService secrets.Service, configStore legacy_storage.AMConfigStore) *ContactPointService {
	t.Helper()
	// Encrypt secure settings.
	xact := newNopTransactionManager()
	provisioningStore := fakes.NewFakeProvisioningStore()

	receiverService := notifier.NewReceiverService(
		ac.NewReceiverAccess[*models.Receiver](acimpl.ProvideAccessControl(featuremgmt.WithFeatures()), true),
		legacy_storage.NewAlertmanagerConfigStore(configStore),
		provisioningStore,
		&fakeAlertRuleNotificationStore{},
		secretService,
		xact,
		log.NewNopLogger(),
		fakes.NewFakeReceiverPermissionsService(),
		tracing.InitializeTracerForTest(),
	)

	return NewContactPointService(
		legacy_storage.NewAlertmanagerConfigStore(configStore),
		secretService,
		provisioningStore,
		xact,
		receiverService,
		log.NewNopLogger(),
		nil,
		fakes.NewFakeReceiverPermissionsService(),
	)
}

func createTestContactPoint() definitions.EmbeddedContactPoint {
	settings, _ := simplejson.NewJson([]byte(`{"recipient":"value_recipient","token":"value_token"}`))
	return definitions.EmbeddedContactPoint{
		Name:     "test-contact-point",
		Type:     "slack",
		Settings: settings,
	}
}

func cpsQuery(orgID int64) ContactPointQuery {
	return ContactPointQuery{
		OrgID: orgID,
	}
}

func cpsQueryWithName(orgID int64, name string) ContactPointQuery {
	return ContactPointQuery{
		OrgID: orgID,
		Name:  name,
	}
}

func createEncryptedConfig(t *testing.T, secretService secrets.Service) string {
	c := &definitions.PostableUserConfig{}
	err := json.Unmarshal([]byte(defaultAlertmanagerConfigJSON), c)
	require.NoError(t, err)
	err = notifier.EncryptReceiverConfigs(c.AlertmanagerConfig.Receivers, func(ctx context.Context, payload []byte) ([]byte, error) {
		return secretService.Encrypt(ctx, payload, secrets.WithoutScope())
	})
	require.NoError(t, err)
	bytes, err := json.Marshal(c)
	require.NoError(t, err)
	return string(bytes)
}

func TestStitchReceivers(t *testing.T) {
	type testCase struct {
		name               string
		initial            *definitions.PostableUserConfig
		new                *definitions.PostableGrafanaReceiver
		expCfg             definitions.PostableApiAlertingConfig
		expOldReceiver     string
		expCreatedReceiver bool
		expFullRemoval     bool
	}

	cases := []testCase{
		{
			name: "non matching receiver by UID, no change",
			new: &definitions.PostableGrafanaReceiver{
				UID: "does not exist",
			},
			expOldReceiver: "",
			expCfg:         createTestConfigWithReceivers().AlertmanagerConfig,
		},
		{
			name: "matching receiver with unchanged name, replaces",
			new: &definitions.PostableGrafanaReceiver{
				UID:  "ghi",
				Name: "receiver-2",
				Type: "teams",
			},
			expOldReceiver: "receiver-2",
			expCfg: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{
						Receiver: "receiver-1",
						Routes: []*definitions.Route{
							{
								Receiver: "receiver-1",
							},
						},
					},
				},
				Receivers: []*definitions.PostableApiReceiver{
					{
						Receiver: config.Receiver{
							Name: "receiver-1",
						},
						PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
								{
									UID:  "abc",
									Name: "receiver-1",
									Type: "slack",
								},
							},
						},
					},
					{
						Receiver: config.Receiver{
							Name: "receiver-2",
						},
						PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
								{
									UID:  "def",
									Name: "receiver-2",
									Type: "slack",
								},
								{
									UID:  "ghi",
									Name: "receiver-2",
									Type: "teams",
								},
								{
									UID:  "jkl",
									Name: "receiver-2",
									Type: "discord",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "rename with only one receiver in group, renames group and references",
			new: &definitions.PostableGrafanaReceiver{
				UID:  "abc",
				Name: "new-receiver",
				Type: "slack",
			},
			expOldReceiver:     "receiver-1",
			expCreatedReceiver: true,
			expFullRemoval:     true,
			expCfg: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{
						Receiver: "receiver-1",
						Routes: []*definitions.Route{
							{
								Receiver: "receiver-1",
							},
						},
					},
				},
				Receivers: []*definitions.PostableApiReceiver{
					{
						Receiver: config.Receiver{
							Name: "new-receiver",
						},
						PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
								{
									UID:  "abc",
									Name: "new-receiver",
									Type: "slack",
								},
							},
						},
					},
					{
						Receiver: config.Receiver{
							Name: "receiver-2",
						},
						PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
								{
									UID:  "def",
									Name: "receiver-2",
									Type: "slack",
								},
								{
									UID:  "ghi",
									Name: "receiver-2",
									Type: "email",
								},
								{
									UID:  "jkl",
									Name: "receiver-2",
									Type: "discord",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "rename to another existing group, moves receiver",
			new: &definitions.PostableGrafanaReceiver{
				UID:  "def",
				Name: "receiver-1",
				Type: "slack",
			},
			expOldReceiver:     "receiver-2",
			expCreatedReceiver: false,
			expCfg: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{
						Receiver: "receiver-1",
						Routes: []*definitions.Route{
							{
								Receiver: "receiver-1",
							},
						},
					},
				},
				Receivers: []*definitions.PostableApiReceiver{
					{
						Receiver: config.Receiver{
							Name: "receiver-1",
						},
						PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
								{
									UID:  "abc",
									Name: "receiver-1",
									Type: "slack",
								},
								{
									UID:  "def",
									Name: "receiver-1",
									Type: "slack",
								},
							},
						},
					},
					{
						Receiver: config.Receiver{
							Name: "receiver-2",
						},
						PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
								{
									UID:  "ghi",
									Name: "receiver-2",
									Type: "email",
								},
								{
									UID:  "jkl",
									Name: "receiver-2",
									Type: "discord",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "rename to another, larger group",
			initial: &definitions.PostableUserConfig{
				AlertmanagerConfig: definitions.PostableApiAlertingConfig{
					Config: definitions.Config{
						Route: &definitions.Route{
							Receiver: "receiver-1",
							Routes: []*definitions.Route{
								{
									Receiver: "receiver-1",
								},
							},
						},
					},
					Receivers: []*definitions.PostableApiReceiver{
						{
							Receiver: config.Receiver{
								Name: "receiver-1",
							},
							PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
								GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
									{
										UID:  "1",
										Name: "receiver-1",
										Type: "slack",
									},
									{
										UID:  "2",
										Name: "receiver-1",
										Type: "slack",
									},
								},
							},
						},
						{
							Receiver: config.Receiver{
								Name: "receiver-2",
							},
							PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
								GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
									{
										UID:  "3",
										Name: "receiver-2",
										Type: "slack",
									},
									{
										UID:  "4",
										Name: "receiver-2",
										Type: "slack",
									},
									{
										UID:  "5",
										Name: "receiver-2",
										Type: "slack",
									},
								},
							},
						},
					},
				},
			},
			new: &definitions.PostableGrafanaReceiver{
				UID:  "2",
				Name: "receiver-2",
				Type: "slack",
			},
			expOldReceiver:     "receiver-1",
			expCreatedReceiver: false,
			expCfg: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{
						Receiver: "receiver-1",
						Routes: []*definitions.Route{
							{
								Receiver: "receiver-1",
							},
						},
					},
				},
				Receivers: []*definitions.PostableApiReceiver{
					{
						Receiver: config.Receiver{
							Name: "receiver-1",
						},
						PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
								{
									UID:  "1",
									Name: "receiver-1",
									Type: "slack",
								},
							},
						},
					},
					{
						Receiver: config.Receiver{
							Name: "receiver-2",
						},
						PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
								{
									UID:  "3",
									Name: "receiver-2",
									Type: "slack",
								},
								{
									UID:  "4",
									Name: "receiver-2",
									Type: "slack",
								},
								{
									UID:  "5",
									Name: "receiver-2",
									Type: "slack",
								},
								{
									UID:  "2",
									Name: "receiver-2",
									Type: "slack",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "rename when there are many groups",
			initial: &definitions.PostableUserConfig{
				AlertmanagerConfig: definitions.PostableApiAlertingConfig{
					Config: definitions.Config{
						Route: &definitions.Route{
							Receiver: "receiver-1",
							Routes: []*definitions.Route{
								{
									Receiver: "receiver-1",
								},
							},
						},
					},
					Receivers: []*definitions.PostableApiReceiver{
						{
							Receiver: config.Receiver{
								Name: "receiver-1",
							},
							PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
								GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
									{
										UID:  "1",
										Name: "receiver-1",
										Type: "slack",
									},
									{
										UID:  "2",
										Name: "receiver-1",
										Type: "slack",
									},
								},
							},
						},
						{
							Receiver: config.Receiver{
								Name: "receiver-2",
							},
							PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
								GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
									{
										UID:  "3",
										Name: "receiver-2",
										Type: "slack",
									},
								},
							},
						},
						{
							Receiver: config.Receiver{
								Name: "receiver-3",
							},
							PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
								GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
									{
										UID:  "4",
										Name: "receiver-4",
										Type: "slack",
									},
								},
							},
						},
						{
							Receiver: config.Receiver{
								Name: "receiver-4",
							},
							PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
								GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
									{
										UID:  "5",
										Name: "receiver-4",
										Type: "slack",
									},
								},
							},
						},
					},
				},
			},
			new: &definitions.PostableGrafanaReceiver{
				UID:  "2",
				Name: "receiver-4",
				Type: "slack",
			},
			expOldReceiver:     "receiver-1",
			expCreatedReceiver: false,
			expCfg: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{
						Receiver: "receiver-1",
						Routes: []*definitions.Route{
							{
								Receiver: "receiver-1",
							},
						},
					},
				},
				Receivers: []*definitions.PostableApiReceiver{
					{
						Receiver: config.Receiver{
							Name: "receiver-1",
						},
						PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
								{
									UID:  "1",
									Name: "receiver-1",
									Type: "slack",
								},
							},
						},
					},
					{
						Receiver: config.Receiver{
							Name: "receiver-2",
						},
						PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
								{
									UID:  "3",
									Name: "receiver-2",
									Type: "slack",
								},
							},
						},
					},
					{
						Receiver: config.Receiver{
							Name: "receiver-3",
						},
						PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
								{
									UID:  "4",
									Name: "receiver-4",
									Type: "slack",
								},
							},
						},
					},
					{
						Receiver: config.Receiver{
							Name: "receiver-4",
						},
						PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
								{
									UID:  "5",
									Name: "receiver-4",
									Type: "slack",
								},
								{
									UID:  "2",
									Name: "receiver-4",
									Type: "slack",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "rename to a name that doesn't exist, creates new group and moves",
			new: &definitions.PostableGrafanaReceiver{
				UID:  "jkl",
				Name: "brand-new-group",
				Type: "opsgenie",
			},
			expOldReceiver:     "receiver-2",
			expCreatedReceiver: true,
			expCfg: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{
						Receiver: "receiver-1",
						Routes: []*definitions.Route{
							{
								Receiver: "receiver-1",
							},
						},
					},
				},
				Receivers: []*definitions.PostableApiReceiver{
					{
						Receiver: config.Receiver{
							Name: "receiver-1",
						},
						PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
								{
									UID:  "abc",
									Name: "receiver-1",
									Type: "slack",
								},
							},
						},
					},
					{
						Receiver: config.Receiver{
							Name: "receiver-2",
						},
						PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
								{
									UID:  "def",
									Name: "receiver-2",
									Type: "slack",
								},
								{
									UID:  "ghi",
									Name: "receiver-2",
									Type: "email",
								},
							},
						},
					},
					{
						Receiver: config.Receiver{
							Name: "brand-new-group",
						},
						PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
								{
									UID:  "jkl",
									Name: "brand-new-group",
									Type: "opsgenie",
								},
							},
						},
					},
				},
			},
		},
		{
			name:    "rename an inconsistent group in the database, algorithm fixes it",
			initial: createInconsistentTestConfigWithReceivers(),
			new: &definitions.PostableGrafanaReceiver{
				UID:  "ghi",
				Name: "brand-new-group",
				Type: "opsgenie",
			},
			expOldReceiver:     "receiver-2", // Not the inconsistent receiver-3?
			expCreatedReceiver: true,
			expCfg: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{
						Receiver: "receiver-1",
						Routes: []*definitions.Route{
							{
								Receiver: "receiver-1",
							},
						},
					},
				},
				Receivers: []*definitions.PostableApiReceiver{
					{
						Receiver: config.Receiver{
							Name: "receiver-1",
						},
						PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
								{
									UID:  "abc",
									Name: "receiver-1",
									Type: "slack",
								},
							},
						},
					},
					{
						Receiver: config.Receiver{
							Name: "receiver-2",
						},
						PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
								{
									UID:  "def",
									Name: "receiver-2",
									Type: "slack",
								},
								{
									UID:  "jkl",
									Name: "receiver-2",
									Type: "discord",
								},
							},
						},
					},
					{
						Receiver: config.Receiver{
							Name: "brand-new-group",
						},
						PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
								{
									UID:  "ghi",
									Name: "brand-new-group",
									Type: "opsgenie",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "single item group rename to existing group",
			initial: &definitions.PostableUserConfig{
				AlertmanagerConfig: definitions.PostableApiAlertingConfig{
					Config: definitions.Config{
						Route: &definitions.Route{
							Receiver: "receiver-1",
							Routes: []*definitions.Route{
								{
									Receiver: "receiver-1",
								},
								{
									Receiver: "receiver-2",
								},
							},
						},
					},
					Receivers: []*definitions.PostableApiReceiver{
						{
							Receiver: config.Receiver{
								Name: "receiver-1",
							},
							PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
								GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
									{
										UID:  "1",
										Name: "receiver-1",
										Type: "slack",
									},
									{
										UID:  "2",
										Name: "receiver-1",
										Type: "slack",
									},
								},
							},
						},
						{
							Receiver: config.Receiver{
								Name: "receiver-2",
							},
							PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
								GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
									{
										UID:  "3",
										Name: "receiver-2",
										Type: "slack",
									},
								},
							},
						},
					},
				},
			},
			new: &definitions.PostableGrafanaReceiver{
				UID:  "3",
				Name: "receiver-1",
				Type: "slack",
			},
			expOldReceiver:     "receiver-2",
			expCreatedReceiver: false,
			expFullRemoval:     true,
			expCfg: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{
						Receiver: "receiver-1",
						Routes: []*definitions.Route{
							{
								Receiver: "receiver-1",
							},
							{
								Receiver: "receiver-2",
							},
						},
					},
				},
				Receivers: []*definitions.PostableApiReceiver{
					{
						Receiver: config.Receiver{
							Name: "receiver-1",
						},
						PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
								{
									UID:  "1",
									Name: "receiver-1",
									Type: "slack",
								},
								{
									UID:  "2",
									Name: "receiver-1",
									Type: "slack",
								},
								{
									UID:  "3",
									Name: "receiver-1",
									Type: "slack",
								},
							},
						},
					},
				},
			},
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			cfg := createTestConfigWithReceivers()
			if c.initial != nil {
				cfg = c.initial
			}

			renamedReceiver, fullRemoval, createdReceiver := stitchReceiver(cfg, c.new)
			assert.Equalf(t, c.expOldReceiver, renamedReceiver, "expected old receiver to be %s, got %s", c.expOldReceiver, renamedReceiver)
			assert.Equalf(t, c.expFullRemoval, fullRemoval, "expected full removal to be %t, got %t", c.expFullRemoval, fullRemoval)
			assert.Equalf(t, c.expCreatedReceiver, createdReceiver, "expected created receiver to be %t, got %t", c.expCreatedReceiver, createdReceiver)
			require.Equal(t, c.expCfg, cfg.AlertmanagerConfig)
		})
	}
}

func createTestConfigWithReceivers() *definitions.PostableUserConfig {
	return &definitions.PostableUserConfig{
		AlertmanagerConfig: definitions.PostableApiAlertingConfig{
			Config: definitions.Config{
				Route: &definitions.Route{
					Receiver: "receiver-1",
					Routes: []*definitions.Route{
						{
							Receiver: "receiver-1",
						},
					},
				},
			},
			Receivers: []*definitions.PostableApiReceiver{
				{
					Receiver: config.Receiver{
						Name: "receiver-1",
					},
					PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
						GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
							{
								UID:  "abc",
								Name: "receiver-1",
								Type: "slack",
							},
						},
					},
				},
				{
					Receiver: config.Receiver{
						Name: "receiver-2",
					},
					PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
						GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
							{
								UID:  "def",
								Name: "receiver-2",
								Type: "slack",
							},
							{
								UID:  "ghi",
								Name: "receiver-2",
								Type: "email",
							},
							{
								UID:  "jkl",
								Name: "receiver-2",
								Type: "discord",
							},
						},
					},
				},
			},
		},
	}
}

// This is an invalid config, with inconsistently named receivers (intentionally).
func createInconsistentTestConfigWithReceivers() *definitions.PostableUserConfig {
	return &definitions.PostableUserConfig{
		AlertmanagerConfig: definitions.PostableApiAlertingConfig{
			Config: definitions.Config{
				Route: &definitions.Route{
					Receiver: "receiver-1",
					Routes: []*definitions.Route{
						{
							Receiver: "receiver-1",
						},
					},
				},
			},
			Receivers: []*definitions.PostableApiReceiver{
				{
					Receiver: config.Receiver{
						Name: "receiver-1",
					},
					PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
						GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
							{
								UID:  "abc",
								Name: "receiver-1",
								Type: "slack",
							},
						},
					},
				},
				{
					Receiver: config.Receiver{
						Name: "receiver-2",
					},
					PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
						GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
							{
								UID:  "def",
								Name: "receiver-2",
								Type: "slack",
							},
							{
								UID:  "ghi",
								Name: "receiver-3",
								Type: "email",
							},
							{
								UID:  "jkl",
								Name: "receiver-2",
								Type: "discord",
							},
						},
					},
				},
			},
		},
	}
}
