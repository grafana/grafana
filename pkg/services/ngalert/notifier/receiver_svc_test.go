package notifier

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/prometheus/alertmanager/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	ac "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning/validation"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	fake_secrets "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

func TestIntegrationReceiverService_GetReceiver(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	sqlStore := db.InitTestDB(t)
	secretsService := manager.SetupTestService(t, database.ProvideSecretsStore(sqlStore))

	redactedUser := &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
		1: {
			accesscontrol.ActionAlertingNotificationsRead: nil,
		},
	}}

	t.Run("service gets receiver from AM config", func(t *testing.T) {
		sut := createReceiverServiceSut(t, secretsService)

		Receiver, err := sut.GetReceiver(context.Background(), singleQ(1, "slack receiver"), redactedUser)
		require.NoError(t, err)
		require.Equal(t, "slack receiver", Receiver.Name)
		require.Len(t, Receiver.Integrations, 1)
		require.Equal(t, "UID2", Receiver.Integrations[0].UID)
	})

	t.Run("service returns error when receiver does not exist", func(t *testing.T) {
		sut := createReceiverServiceSut(t, secretsService)

		_, err := sut.GetReceiver(context.Background(), singleQ(1, "nonexistent"), redactedUser)
		require.ErrorIs(t, err, legacy_storage.ErrReceiverNotFound)
	})
}

func TestIntegrationReceiverService_GetReceivers(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	sqlStore := db.InitTestDB(t)
	secretsService := manager.SetupTestService(t, database.ProvideSecretsStore(sqlStore))

	redactedUser := &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
		1: {
			accesscontrol.ActionAlertingNotificationsRead: nil,
		},
	}}

	t.Run("service gets receivers from AM config", func(t *testing.T) {
		sut := createReceiverServiceSut(t, secretsService)

		Receivers, err := sut.GetReceivers(context.Background(), multiQ(1), redactedUser)
		require.NoError(t, err)
		require.Len(t, Receivers, 2)
		require.Equal(t, "grafana-default-email", Receivers[0].Name)
		require.Equal(t, "slack receiver", Receivers[1].Name)
	})

	t.Run("service filters receivers by name", func(t *testing.T) {
		sut := createReceiverServiceSut(t, secretsService)

		Receivers, err := sut.GetReceivers(context.Background(), multiQ(1, "slack receiver"), redactedUser)
		require.NoError(t, err)
		require.Len(t, Receivers, 1)
		require.Equal(t, "slack receiver", Receivers[0].Name)
	})
}

func TestIntegrationReceiverService_DecryptRedact(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	sqlStore := db.InitTestDB(t)
	secretsService := manager.SetupTestService(t, database.ProvideSecretsStore(sqlStore))

	getMethods := []string{"single", "multi"}

	readUser := &user.SignedInUser{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {accesscontrol.ActionAlertingNotificationsRead: nil},
		},
	}

	secretUser := &user.SignedInUser{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {
				accesscontrol.ActionAlertingNotificationsRead:    nil,
				accesscontrol.ActionAlertingReceiversReadSecrets: {ac.ScopeReceiversAll},
			},
		},
	}

	for _, tc := range []struct {
		name    string
		decrypt bool
		user    identity.Requester
		err     string
	}{
		{
			name:    "service redacts receivers by default",
			decrypt: false,
			user:    readUser,
			err:     "",
		},
		{
			name:    "service returns error when trying to decrypt without permission",
			decrypt: true,
			user:    readUser,
			err:     "[alerting.unauthorized] user is not authorized to read any decrypted receiver",
		},
		{
			name:    "service returns error if user is nil and decrypt is true",
			decrypt: true,
			user:    nil,
			err:     "[alerting.unauthorized] user is not authorized to read any decrypted receiver",
		},
		{
			name:    "service decrypts receivers with permission",
			decrypt: true,
			user:    secretUser,
			err:     "",
		},
	} {
		for _, method := range getMethods {
			t.Run(fmt.Sprintf("%s %s", tc.name, method), func(t *testing.T) {
				sut := createReceiverServiceSut(t, secretsService)

				var res *models.Receiver
				var err error
				if method == "single" {
					q := singleQ(1, "slack receiver")
					q.Decrypt = tc.decrypt
					res, err = sut.GetReceiver(context.Background(), q, tc.user)
				} else {
					q := multiQ(1, "slack receiver")
					q.Decrypt = tc.decrypt
					var multiRes []*models.Receiver
					multiRes, err = sut.GetReceivers(context.Background(), q, tc.user)
					if tc.err == "" {
						require.Len(t, multiRes, 1)
						res = multiRes[0]
					}
				}
				if tc.err == "" {
					require.NoError(t, err)
				} else {
					require.ErrorContains(t, err, tc.err)
				}

				if tc.err == "" {
					require.Equal(t, "slack receiver", res.Name)
					require.Len(t, res.Integrations, 1)
					require.Equal(t, "UID2", res.Integrations[0].UID)

					require.NoError(t, err)
					if tc.decrypt {
						require.Equal(t, "secure url", res.Integrations[0].Settings["url"])
						require.NotContains(t, res.Integrations[0].SecureSettings, "url")
					} else {
						require.NotContains(t, res.Integrations[0].Settings, "url")

						// Ensure the encrypted value exists and is not redacted or decrypted.
						require.NotEmpty(t, res.Integrations[0].SecureSettings["url"])
						require.NotEqual(t, definitions.RedactedValue, res.Integrations[0].SecureSettings["url"])
						require.NotEqual(t, "secure url", res.Integrations[0].SecureSettings["url"])
					}
				}
			})
		}
	}
}

func TestReceiverService_Delete(t *testing.T) {
	secretsService := fake_secrets.NewFakeSecretsService()

	writer := &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
		1: {
			accesscontrol.ActionAlertingNotificationsWrite: nil,
			accesscontrol.ActionAlertingNotificationsRead:  nil,
		},
	}}

	slackIntegration := models.IntegrationGen(models.IntegrationMuts.WithName("test receiver"), models.IntegrationMuts.WithValidConfig("slack"))()
	emailIntegration := models.IntegrationGen(models.IntegrationMuts.WithName("test receiver"), models.IntegrationMuts.WithValidConfig("email"))()
	baseReceiver := models.ReceiverGen(models.ReceiverMuts.WithName("test receiver"), models.ReceiverMuts.WithIntegrations(slackIntegration))()

	for _, tc := range []struct {
		name             string
		user             identity.Requester
		deleteUID        string
		callerProvenance models.Provenance
		version          string
		storeSettings    map[models.AlertRuleKey][]models.NotificationSettings
		existing         *models.Receiver
		expectedErr      error
	}{
		{
			name:      "service deletes receiver",
			user:      writer,
			deleteUID: baseReceiver.UID,
			existing:  util.Pointer(baseReceiver.Clone()),
		},
		{
			name:      "service deletes receiver with multiple integrations",
			user:      writer,
			deleteUID: baseReceiver.UID,
			existing:  util.Pointer(models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithIntegrations(slackIntegration, emailIntegration))),
		},
		{
			name:             "service deletes receiver with provenance",
			user:             writer,
			deleteUID:        baseReceiver.UID,
			callerProvenance: models.ProvenanceAPI,
			existing:         util.Pointer(models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithProvenance(models.ProvenanceAPI), models.ReceiverMuts.WithIntegrations(slackIntegration, emailIntegration))),
		},
		{
			name:      "non-existing receiver doesn't fail",
			user:      writer,
			deleteUID: "non-existent",
		},
		{
			name:        "delete receiver used by route fails",
			user:        writer,
			deleteUID:   legacy_storage.NameToUid("grafana-default-email"),
			version:     "cd95627c75892a39", // Correct version for grafana-default-email.
			expectedErr: makeReceiverInUseErr(true, nil),
		},
		{
			name:      "delete receiver used by rule fails",
			user:      writer,
			deleteUID: baseReceiver.UID,
			existing:  util.Pointer(baseReceiver.Clone()),
			storeSettings: map[models.AlertRuleKey][]models.NotificationSettings{
				{OrgID: 1, UID: "rule1"}: {
					models.NotificationSettingsGen(models.NSMuts.WithReceiver(baseReceiver.Name))(),
				},
			},
			expectedErr: makeReceiverInUseErr(false, []models.AlertRuleKey{{OrgID: 1, UID: "rule1"}}),
		},
		{
			name:             "delete provisioning provenance fails when caller is ProvenanceNone",
			user:             writer,
			deleteUID:        baseReceiver.UID,
			callerProvenance: models.ProvenanceNone,
			existing:         util.Pointer(models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithProvenance(models.ProvenanceFile))),
			expectedErr:      validation.MakeErrProvenanceChangeNotAllowed(models.ProvenanceFile, models.ProvenanceNone),
		},
		{
			name:             "delete provisioning provenance fails when caller is a different type", // TODO: This should fail once we move from lenient to strict validation.
			user:             writer,
			deleteUID:        baseReceiver.UID,
			callerProvenance: models.ProvenanceFile,
			existing:         util.Pointer(models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithProvenance(models.ProvenanceAPI))),
			// expectedErr:      validation.MakeErrProvenanceChangeNotAllowed(models.ProvenanceAPI, models.ProvenanceFile),
		},
		{
			name:        "delete receiver with optimistic version mismatch fails",
			user:        writer,
			deleteUID:   baseReceiver.UID,
			existing:    util.Pointer(baseReceiver.Clone()),
			version:     "wrong version",
			expectedErr: ErrReceiverVersionConflict,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := &fakeAlertRuleNotificationStore{}
			store.ListNotificationSettingsFn = func(ctx context.Context, q models.ListNotificationSettingsQuery) (map[models.AlertRuleKey][]models.NotificationSettings, error) {
				return tc.storeSettings, nil
			}
			sut := createReceiverServiceSut(t, &secretsService)
			sut.ruleNotificationsStore = store

			if tc.existing != nil {
				created, err := sut.CreateReceiver(context.Background(), tc.existing, tc.user.GetOrgID(), tc.user)
				require.NoError(t, err)

				if tc.version == "" {
					tc.version = created.Version
				}
			}

			err := sut.DeleteReceiver(context.Background(), tc.deleteUID, tc.callerProvenance, tc.version, tc.user.GetOrgID(), tc.user)
			if tc.expectedErr == nil {
				require.NoError(t, err)
			} else {
				assert.ErrorIs(t, err, tc.expectedErr)
				return
			}
			// Ensure receiver saved to store is correct.
			name, err := legacy_storage.UidToName(tc.deleteUID)
			require.NoError(t, err)
			q := models.GetReceiverQuery{OrgID: tc.user.GetOrgID(), Name: name}
			_, err = sut.GetReceiver(context.Background(), q, writer)
			assert.ErrorIs(t, err, legacy_storage.ErrReceiverNotFound)

			provenances, err := sut.provisioningStore.GetProvenances(context.Background(), tc.user.GetOrgID(), (&definitions.EmbeddedContactPoint{}).ResourceType())
			require.NoError(t, err)
			assert.Len(t, provenances, 0)
		})
	}
}

func TestReceiverService_Create(t *testing.T) {
	secretsService := fake_secrets.NewFakeSecretsService()

	writer := &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
		1: {
			accesscontrol.ActionAlertingNotificationsWrite: nil,
			accesscontrol.ActionAlertingNotificationsRead:  nil,
		},
	}}
	decryptUser := &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
		1: {
			accesscontrol.ActionAlertingReceiversReadSecrets: {ac.ScopeReceiversAll},
		},
	}}

	// Used to mark generated fields to replace during test runtime.
	generated := func(n int) string { return fmt.Sprintf("[GENERATED]%d", n) }
	isGenerated := func(s string) bool { return strings.HasPrefix(s, "[GENERATED]") }

	slackIntegration := models.IntegrationGen(models.IntegrationMuts.WithName("test receiver"), models.IntegrationMuts.WithValidConfig("slack"))()
	emailIntegration := models.IntegrationGen(models.IntegrationMuts.WithName("test receiver"), models.IntegrationMuts.WithValidConfig("email"))()
	lineIntegration := models.IntegrationGen(models.IntegrationMuts.WithName("test receiver"), models.IntegrationMuts.WithValidConfig("line"))()
	baseReceiver := models.ReceiverGen(models.ReceiverMuts.WithName("test receiver"), models.ReceiverMuts.WithIntegrations(slackIntegration))()

	for _, tc := range []struct {
		name                string
		user                identity.Requester
		receiver            models.Receiver
		expectedCreate      models.Receiver
		expectedStored      *definitions.PostableApiReceiver
		expectedErr         error
		expectedProvenances map[string]models.Provenance
	}{
		{
			name:                "service creates receiver",
			user:                writer,
			receiver:            baseReceiver.Clone(),
			expectedCreate:      models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.Encrypted(models.Base64Enrypt)),
			expectedProvenances: map[string]models.Provenance{slackIntegration.UID: models.ProvenanceNone},
		},
		{
			name:                "service creates receiver with multiple integrations",
			user:                writer,
			receiver:            models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithIntegrations(slackIntegration, emailIntegration)),
			expectedCreate:      models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithIntegrations(slackIntegration, emailIntegration), models.ReceiverMuts.Encrypted(models.Base64Enrypt)),
			expectedProvenances: map[string]models.Provenance{slackIntegration.UID: models.ProvenanceNone, emailIntegration.UID: models.ProvenanceNone},
		},
		{
			name:                "service creates receiver with provenance",
			user:                writer,
			receiver:            models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithProvenance(models.ProvenanceAPI), models.ReceiverMuts.WithIntegrations(slackIntegration, emailIntegration)),
			expectedCreate:      models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithProvenance(models.ProvenanceAPI), models.ReceiverMuts.WithIntegrations(slackIntegration, emailIntegration), models.ReceiverMuts.Encrypted(models.Base64Enrypt)),
			expectedProvenances: map[string]models.Provenance{slackIntegration.UID: models.ProvenanceAPI, emailIntegration.UID: models.ProvenanceAPI},
		},
		{
			name:        "existing receiver fails",
			user:        writer,
			receiver:    models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithName("grafana-default-email")),
			expectedErr: legacy_storage.ErrReceiverExists,
		},
		{
			name: "create integration with empty UID generates a new UID",
			user: writer,
			receiver: models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithIntegrations(
				models.CopyIntegrationWith(slackIntegration, models.IntegrationMuts.WithUID("")),
				models.CopyIntegrationWith(emailIntegration, models.IntegrationMuts.WithUID("")),
			)),
			expectedCreate: models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithIntegrations(
				models.CopyIntegrationWith(slackIntegration, models.IntegrationMuts.WithUID(generated(0))), // Mark UIDs as generated so that test will insert generated UID.
				models.CopyIntegrationWith(emailIntegration, models.IntegrationMuts.WithUID(generated(1))),
			), models.ReceiverMuts.Encrypted(models.Base64Enrypt)),
			expectedProvenances: map[string]models.Provenance{generated(0): models.ProvenanceNone, generated(1): models.ProvenanceNone}, // Mark UIDs as generated so that test will insert generated UID.
		},
		{
			name: "create integration with invalid UID fails",
			user: writer,
			receiver: models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithIntegrations(
				models.CopyIntegrationWith(slackIntegration, models.IntegrationMuts.WithUID("///@#$%^&*(")),
			)),
			expectedErr: legacy_storage.ErrReceiverInvalid,
		},
		{
			name: "create integration with existing UID fails",
			user: writer,
			receiver: models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithIntegrations(
				models.CopyIntegrationWith(slackIntegration, models.IntegrationMuts.WithUID("UID1")), // UID of grafana-default-email.
			)),
			expectedErr: legacy_storage.ErrReceiverInvalid,
		},
		{
			name:        "create with invalid integration fails",
			user:        writer,
			receiver:    models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithInvalidIntegration("slack")),
			expectedErr: legacy_storage.ErrReceiverInvalid,
		},
		{
			name: "create integration with no normal settings should not store nil settings",
			user: writer,
			receiver: models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithIntegrations(
				models.CopyIntegrationWith(lineIntegration,
					models.IntegrationMuts.WithSettings(
						map[string]any{ // Line is valid with only the single secure field "token", so Settings will be empty when saving.
							"token": "secret",
						},
					)),
			)),
			expectedCreate: models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithIntegrations(
				models.CopyIntegrationWith(lineIntegration,
					models.IntegrationMuts.WithSettings(
						map[string]any{}, // Empty settings, not nil.
					),
					models.IntegrationMuts.WithSecureSettings(
						map[string]string{
							"token": "c2VjcmV0", // base64 encoded "secret".
						},
					),
				),
			)),
			expectedStored: &definitions.PostableApiReceiver{
				Receiver: config.Receiver{
					Name: lineIntegration.Name,
				},
				PostableGrafanaReceivers: definitions.PostableGrafanaReceivers{
					GrafanaManagedReceivers: []*definitions.PostableGrafanaReceiver{
						{
							UID:                   lineIntegration.UID,
							Name:                  lineIntegration.Name,
							Type:                  lineIntegration.Config.Type,
							DisableResolveMessage: lineIntegration.DisableResolveMessage,
							Settings:              definitions.RawMessage(`{}`), // Empty settings, not nil.
							SecureSettings: map[string]string{
								"token": "c2VjcmV0", // base64 encoded "secret".
							},
						},
					},
				},
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			sut := createReceiverServiceSut(t, &secretsService)

			created, err := sut.CreateReceiver(context.Background(), &tc.receiver, tc.user.GetOrgID(), tc.user)
			if tc.expectedErr == nil {
				require.NoError(t, err)
			} else {
				assert.ErrorIs(t, err, tc.expectedErr)
				return
			}

			// First verify generated UIDs. We can't compare set them directly in expected because they are generated,
			// so we ensure that all empty UIDs in expectedUpdate are not empty in updated.
			generatedUIDs := make(map[string]string)
			for i, integration := range tc.expectedCreate.Integrations {
				if isGenerated(integration.UID) {
					// Check that the UID was, in fact, generated.
					if created.Integrations[i].UID != "" {
						generatedUIDs[integration.UID] = created.Integrations[i].UID
						// This ensures the following assert.Equal will pass for this generated field.
						integration.UID = created.Integrations[i].UID
					}
				}
			}
			if len(generatedUIDs) > 0 {
				// Version was calculated without generated UIDs.
				tc.expectedCreate.Version = tc.expectedCreate.Fingerprint()

				// Set UIDs in expected provenance.
				for k, v := range tc.expectedProvenances {
					if gen, ok := generatedUIDs[k]; ok {
						tc.expectedProvenances[gen] = v
						delete(tc.expectedProvenances, k)
					}
				}
			}

			assert.Equal(t, tc.expectedCreate, *created)

			// Ensure receiver saved to store is correct.
			q := models.GetReceiverQuery{OrgID: tc.user.GetOrgID(), Name: tc.receiver.Name, Decrypt: true}
			stored, err := sut.GetReceiver(context.Background(), q, decryptUser)
			require.NoError(t, err)
			decrypted := models.CopyReceiverWith(tc.expectedCreate, models.ReceiverMuts.Decrypted(models.Base64Decrypt))
			decrypted.Version = tc.expectedCreate.Version // Version is calculated before decryption.
			assert.Equal(t, decrypted, *stored)

			if tc.expectedProvenances != nil {
				provenances, err := sut.provisioningStore.GetProvenances(context.Background(), tc.user.GetOrgID(), (&definitions.EmbeddedContactPoint{}).ResourceType())
				require.NoError(t, err)
				assert.Equal(t, tc.expectedProvenances, provenances)
			}

			if tc.expectedStored != nil {
				revision, err := sut.cfgStore.Get(context.Background(), writer.GetOrgID())
				require.NoError(t, err)
				for _, apiReceiver := range revision.Config.AlertmanagerConfig.Receivers {
					if apiReceiver.Name == tc.expectedStored.Name {
						assert.Equal(t, tc.expectedStored, apiReceiver)
						return
					}
				}
				t.Fatalf("expected to find receiver %q in revision", tc.expectedStored.Name)
			}
		})
	}
}

func TestReceiverService_Update(t *testing.T) {
	secretsService := fake_secrets.NewFakeSecretsService()

	writer := &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
		1: {
			accesscontrol.ActionAlertingNotificationsWrite: nil,
			accesscontrol.ActionAlertingNotificationsRead:  nil,
		},
	}}
	decryptUser := &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
		1: {
			accesscontrol.ActionAlertingReceiversReadSecrets: {ac.ScopeReceiversAll},
		},
	}}

	// Used to mark generated fields to replace during test runtime.
	generated := func(n int) string { return fmt.Sprintf("[GENERATED]%d", n) }
	isGenerated := func(s string) bool { return strings.HasPrefix(s, "[GENERATED]") }

	rm := models.ReceiverMuts
	im := models.IntegrationMuts
	slackIntegration := models.IntegrationGen(models.IntegrationMuts.WithName("test receiver"), models.IntegrationMuts.WithValidConfig("slack"))()
	emailIntegration := models.IntegrationGen(models.IntegrationMuts.WithName("test receiver"), models.IntegrationMuts.WithValidConfig("email"))()
	baseReceiver := models.ReceiverGen(models.ReceiverMuts.WithName("test receiver"), models.ReceiverMuts.WithIntegrations(slackIntegration))()

	for _, tc := range []struct {
		name                string
		user                identity.Requester
		receiver            models.Receiver
		version             string
		secureFields        map[string][]string
		existing            *models.Receiver
		expectedUpdate      models.Receiver
		expectedProvenances map[string]models.Provenance
		expectedErr         error
	}{
		{
			name: "copies existing secure fields",
			user: writer,
			receiver: models.CopyReceiverWith(baseReceiver, rm.WithIntegrations(
				models.CopyIntegrationWith(slackIntegration, im.AddSetting("newField", "newValue"))),
			),
			secureFields: map[string][]string{slackIntegration.UID: {"token"}},
			existing: util.Pointer(models.CopyReceiverWith(baseReceiver, rm.WithIntegrations(
				models.CopyIntegrationWith(slackIntegration,
					im.AddSecureSetting("token", "ZXhpc3RpbmdUb2tlbg=="), // This will get copied.
					im.AddSecureSetting("url", "ZXhpc3RpbmdVcmw="),       // This won't get copied.
				),
			))),
			expectedUpdate: models.CopyReceiverWith(baseReceiver, rm.WithIntegrations(
				models.CopyIntegrationWith(slackIntegration,
					im.AddSetting("newField", "newValue"),
					im.AddSecureSetting("token", "ZXhpc3RpbmdUb2tlbg==")),
			), rm.Encrypted(models.Base64Enrypt)),
			expectedProvenances: map[string]models.Provenance{slackIntegration.UID: models.ProvenanceNone},
		},
		{
			name: "encrypts previously unencrypted secure fields",
			user: writer,
			receiver: models.CopyReceiverWith(baseReceiver, rm.WithIntegrations(
				models.CopyIntegrationWith(slackIntegration, im.AddSetting("token", "unencryptedValue"))),
			),
			existing: util.Pointer(models.CopyReceiverWith(baseReceiver, rm.WithIntegrations(
				models.CopyIntegrationWith(slackIntegration,
					im.AddSetting("token", "unencryptedValue"), // This will get encrypted.
				),
			))),
			expectedUpdate: models.CopyReceiverWith(baseReceiver, rm.WithIntegrations(
				models.CopyIntegrationWith(slackIntegration,
					im.AddSecureSetting("token", "dW5lbmNyeXB0ZWRWYWx1ZQ==")),
			), rm.Encrypted(models.Base64Enrypt)),
			expectedProvenances: map[string]models.Provenance{slackIntegration.UID: models.ProvenanceNone},
		},
		{
			// This test is important for covering the rare case when an existing field is marked as secure.
			// The UI will receive the field as secure and, if unchanged, will pass it back on update as a secureField instead of a Setting.
			name: "encrypts previously unencrypted secure fields when passed in as secureFields",
			user: writer,
			receiver: models.CopyReceiverWith(baseReceiver, rm.WithIntegrations(
				models.CopyIntegrationWith(slackIntegration, im.AddSetting("newField", "newValue"))),
			),
			secureFields: map[string][]string{slackIntegration.UID: {"token"}},
			existing: util.Pointer(models.CopyReceiverWith(baseReceiver, rm.WithIntegrations(
				models.CopyIntegrationWith(slackIntegration,
					im.AddSetting("token", "unencryptedValue"), // This will get encrypted.
				),
			))),
			expectedUpdate: models.CopyReceiverWith(baseReceiver, rm.WithIntegrations(
				models.CopyIntegrationWith(slackIntegration,
					im.AddSetting("newField", "newValue"),
					im.AddSecureSetting("token", "dW5lbmNyeXB0ZWRWYWx1ZQ==")),
			), rm.Encrypted(models.Base64Enrypt)),
			expectedProvenances: map[string]models.Provenance{slackIntegration.UID: models.ProvenanceNone},
		},
		{
			name: "doesn't copy existing unsecure fields",
			user: writer,
			receiver: models.CopyReceiverWith(baseReceiver, rm.WithIntegrations(
				models.CopyIntegrationWith(slackIntegration, im.AddSetting("newField", "newValue"))),
			),
			secureFields: map[string][]string{slackIntegration.UID: {"somefield"}},
			existing: util.Pointer(models.CopyReceiverWith(baseReceiver, rm.WithIntegrations(
				models.CopyIntegrationWith(slackIntegration,
					im.AddSetting("somefield", "somevalue"), // This won't get copied.
				),
			))),
			expectedUpdate: models.CopyReceiverWith(baseReceiver, rm.WithIntegrations(
				models.CopyIntegrationWith(slackIntegration,
					im.AddSetting("newField", "newValue")),
			), rm.Encrypted(models.Base64Enrypt)),
			expectedProvenances: map[string]models.Provenance{slackIntegration.UID: models.ProvenanceNone},
		},
		{
			name:     "creates new provenance when integration is added",
			user:     writer,
			receiver: models.CopyReceiverWith(baseReceiver, rm.WithIntegrations(slackIntegration, emailIntegration), models.ReceiverMuts.WithProvenance(models.ProvenanceFile)),
			existing: util.Pointer(models.CopyReceiverWith(baseReceiver, rm.WithIntegrations(slackIntegration), models.ReceiverMuts.WithProvenance(models.ProvenanceFile))),
			expectedUpdate: models.CopyReceiverWith(baseReceiver,
				rm.WithIntegrations(slackIntegration, emailIntegration),
				models.ReceiverMuts.WithProvenance(models.ProvenanceFile),
				rm.Encrypted(models.Base64Enrypt)),
			expectedProvenances: map[string]models.Provenance{slackIntegration.UID: models.ProvenanceFile, emailIntegration.UID: models.ProvenanceFile},
		},
		{
			name:     "deletes old provenance when integration is removed",
			user:     writer,
			receiver: models.CopyReceiverWith(baseReceiver, rm.WithIntegrations(slackIntegration), models.ReceiverMuts.WithProvenance(models.ProvenanceFile)),
			existing: util.Pointer(models.CopyReceiverWith(baseReceiver, rm.WithIntegrations(slackIntegration, emailIntegration), models.ReceiverMuts.WithProvenance(models.ProvenanceFile))),
			expectedUpdate: models.CopyReceiverWith(baseReceiver,
				rm.WithIntegrations(slackIntegration),
				models.ReceiverMuts.WithProvenance(models.ProvenanceFile),
				rm.Encrypted(models.Base64Enrypt)),
			expectedProvenances: map[string]models.Provenance{slackIntegration.UID: models.ProvenanceFile},
		},
		{
			name:        "changing provenance from something to None fails",
			user:        writer,
			receiver:    models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithProvenance(models.ProvenanceNone)),
			existing:    util.Pointer(models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithProvenance(models.ProvenanceFile))),
			expectedErr: validation.MakeErrProvenanceChangeNotAllowed(models.ProvenanceFile, models.ProvenanceNone),
		},
		{
			name:     "changing provenance from one type to another fails", // TODO: This should fail once we move from lenient to strict validation.
			user:     writer,
			receiver: models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithProvenance(models.ProvenanceAPI)),
			existing: util.Pointer(models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithProvenance(models.ProvenanceFile))),
			// expectedErr: validation.MakeErrProvenanceChangeNotAllowed(models.ProvenanceFile, models.ProvenanceAPI),
			expectedUpdate: models.CopyReceiverWith(baseReceiver,
				models.ReceiverMuts.WithProvenance(models.ProvenanceAPI),
				rm.Encrypted(models.Base64Enrypt)),
			expectedProvenances: map[string]models.Provenance{slackIntegration.UID: models.ProvenanceAPI},
		},
		{
			name:        "update receiver with optimistic version mismatch fails",
			user:        writer,
			receiver:    baseReceiver.Clone(),
			version:     "wrong version",
			existing:    util.Pointer(baseReceiver.Clone()),
			expectedErr: ErrReceiverVersionConflict,
		},
		{
			name:        "update receiver that doesn't exist fails",
			user:        writer,
			receiver:    baseReceiver.Clone(),
			expectedErr: legacy_storage.ErrReceiverNotFound,
		},
		{
			name:     "update that adds new integration generates a new UID",
			user:     writer,
			receiver: models.CopyReceiverWith(baseReceiver, rm.WithIntegrations(slackIntegration, models.CopyIntegrationWith(emailIntegration, im.WithUID("")))),
			existing: util.Pointer(baseReceiver.Clone()),
			expectedUpdate: models.CopyReceiverWith(baseReceiver,
				rm.WithIntegrations(slackIntegration, models.CopyIntegrationWith(emailIntegration, im.WithUID(generated(0)))), // Mark UID as generated so that test will insert generated UID.
				rm.Encrypted(models.Base64Enrypt)),
			expectedProvenances: map[string]models.Provenance{slackIntegration.UID: models.ProvenanceNone, generated(0): models.ProvenanceNone}, // Mark UID as generated so that test will insert generated UID.
		},
		{
			name:        "update with integration that has a UID that already exists fails",
			user:        writer,
			receiver:    models.CopyReceiverWith(baseReceiver, rm.WithIntegrations(slackIntegration, models.CopyIntegrationWith(emailIntegration, im.WithUID(slackIntegration.UID)))),
			existing:    util.Pointer(baseReceiver.Clone()),
			expectedErr: legacy_storage.ErrReceiverInvalid,
		},
		{
			name:        "update with invalid integration fails",
			user:        writer,
			receiver:    models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithInvalidIntegration("slack")),
			existing:    util.Pointer(baseReceiver.Clone()),
			expectedErr: legacy_storage.ErrReceiverInvalid,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			sut := createReceiverServiceSut(t, &secretsService)

			if tc.existing != nil {
				// Create route after receivers as they will be referenced.
				revision, err := sut.cfgStore.Get(context.Background(), tc.user.GetOrgID())
				require.NoError(t, err)
				created, err := revision.CreateReceiver(tc.existing)
				require.NoError(t, err)

				err = sut.cfgStore.Save(context.Background(), revision, tc.user.GetOrgID())
				require.NoError(t, err)

				for _, integration := range created.Integrations {
					target := definitions.EmbeddedContactPoint{UID: integration.UID}
					err = sut.provisioningStore.SetProvenance(context.Background(), &target, tc.user.GetOrgID(), created.Provenance)
					require.NoError(t, err)
				}

				if tc.version == "" {
					tc.version = created.Version
				}
			}

			tc.receiver.Version = tc.version
			updated, err := sut.UpdateReceiver(context.Background(), &tc.receiver, tc.secureFields, tc.user.GetOrgID(), tc.user)
			if tc.expectedErr == nil {
				require.NoError(t, err)
			} else {
				assert.ErrorIs(t, err, tc.expectedErr)
				return
			}

			// First verify generated UIDs. We can't compare set them directly in expected because they are generated,
			// so we ensure that all empty UIDs in expectedUpdate are not empty in updated.
			generatedUIDs := make(map[string]string)
			for i, integration := range tc.expectedUpdate.Integrations {
				if isGenerated(integration.UID) {
					// Check that the UID was, in fact, generated.
					if updated.Integrations[i].UID != "" {
						generatedUIDs[integration.UID] = updated.Integrations[i].UID
						// This ensures the following assert.Equal will pass for this generated field.
						integration.UID = updated.Integrations[i].UID
					}
				}
			}
			if len(generatedUIDs) > 0 {
				// Version was calculated without generated UIDs.
				tc.expectedUpdate.Version = tc.expectedUpdate.Fingerprint()

				// Set UIDs in expected provenance.
				for k, v := range tc.expectedProvenances {
					if gen, ok := generatedUIDs[k]; ok {
						tc.expectedProvenances[gen] = v
						delete(tc.expectedProvenances, k)
					}
				}
			}

			assert.Equal(t, tc.expectedUpdate, *updated)

			// Ensure receiver saved to store is correct.
			q := models.GetReceiverQuery{OrgID: tc.user.GetOrgID(), Name: tc.receiver.Name, Decrypt: true}
			stored, err := sut.GetReceiver(context.Background(), q, decryptUser)
			require.NoError(t, err)
			decrypted := models.CopyReceiverWith(tc.expectedUpdate, models.ReceiverMuts.Decrypted(models.Base64Decrypt))
			decrypted.Version = tc.expectedUpdate.Version // Version is calculated before decryption.
			assert.Equal(t, decrypted, *stored)

			provenances, err := sut.provisioningStore.GetProvenances(context.Background(), tc.user.GetOrgID(), (&definitions.EmbeddedContactPoint{}).ResourceType())
			require.NoError(t, err)
			assert.Equal(t, tc.expectedProvenances, provenances)
		})
	}
}

func TestReceiverService_UpdateReceiverName(t *testing.T) {
	// This test is to ensure that the receiver name is updated in routes and notification settings when the name is changed.
	writer := &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
		1: {
			accesscontrol.ActionAlertingNotificationsWrite: nil,
			accesscontrol.ActionAlertingNotificationsRead:  nil,
		},
	}}

	secretsService := fake_secrets.NewFakeSecretsService()
	receiverName := "grafana-default-email"
	newReceiverName := "new-name"
	slackIntegration := models.IntegrationGen(models.IntegrationMuts.WithName(receiverName), models.IntegrationMuts.WithValidConfig("slack"))()
	baseReceiver := models.ReceiverGen(models.ReceiverMuts.WithName(receiverName), models.ReceiverMuts.WithIntegrations(slackIntegration))()
	baseReceiver.Version = "cd95627c75892a39" // Correct version for grafana-default-email.
	baseReceiver.Name = newReceiverName       // Done here instead of in a mutator so we keep the same uid.

	t.Run("renames receiver and all its dependencies", func(t *testing.T) {
		ruleStore := &fakeAlertRuleNotificationStore{}
		sut := createReceiverServiceSut(t, &secretsService)
		sut.ruleNotificationsStore = ruleStore

		_, err := sut.UpdateReceiver(context.Background(), &baseReceiver, nil, writer.GetOrgID(), writer)
		require.NoError(t, err)

		assert.Equal(t, "RenameReceiverInNotificationSettings", ruleStore.Calls[0].Method)
		assert.Equal(t, writer.OrgID, ruleStore.Calls[0].Args[1])
		assert.Equal(t, receiverName, ruleStore.Calls[0].Args[2])
		assert.Equal(t, newReceiverName, ruleStore.Calls[0].Args[3])
		assert.NotNil(t, ruleStore.Calls[0].Args[4])
		assert.Falsef(t, ruleStore.Calls[0].Args[5].(bool), "dryrun expected to be false")

		// Ensure receiver name is updated in routes.
		revision, err := sut.cfgStore.Get(context.Background(), writer.GetOrgID())
		require.NoError(t, err)

		assert.Falsef(t, revision.ReceiverNameUsedByRoutes(receiverName), "old receiver name '%s' should not be used by routes", receiverName)
		assert.Truef(t, revision.ReceiverNameUsedByRoutes(newReceiverName), "new receiver name '%s' should be used by routes", newReceiverName)
	})

	t.Run("returns ErrReceiverDependentResourcesProvenance if route has different provenance status", func(t *testing.T) {
		sut := createReceiverServiceSut(t, &secretsService)
		provenanceStore := sut.provisioningStore.(*fakes.FakeProvisioningStore)
		provenanceStore.Records[1] = map[string]models.Provenance{
			(&definitions.Route{}).ResourceType(): models.ProvenanceFile,
		}

		ruleStore := &fakeAlertRuleNotificationStore{
			RenameReceiverInNotificationSettingsFn: func(ctx context.Context, orgID int64, old, new string, validate func(models.Provenance) bool, dryRun bool) ([]models.AlertRuleKey, []models.AlertRuleKey, error) {
				assertInTransaction(t, ctx)
				return nil, nil, nil
			},
		}
		sut.ruleNotificationsStore = ruleStore

		_, err := sut.UpdateReceiver(context.Background(), &baseReceiver, nil, writer.GetOrgID(), writer)
		require.ErrorIs(t, err, ErrReceiverDependentResourcesProvenance)

		require.Len(t, ruleStore.Calls, 1)
		assert.Equal(t, "RenameReceiverInNotificationSettings", ruleStore.Calls[0].Method)
		assert.Equal(t, writer.OrgID, ruleStore.Calls[0].Args[1])
		assert.Equal(t, receiverName, ruleStore.Calls[0].Args[2])
		assert.Equal(t, newReceiverName, ruleStore.Calls[0].Args[3])
		assert.NotNil(t, ruleStore.Calls[0].Args[4])
		assert.True(t, ruleStore.Calls[0].Args[5].(bool)) // still check if there are rules that have incompatible provenance
	})

	t.Run("returns ErrReceiverDependentResourcesProvenance if rules have different provenance status", func(t *testing.T) {
		sut := createReceiverServiceSut(t, &secretsService)

		ruleStore := &fakeAlertRuleNotificationStore{
			RenameReceiverInNotificationSettingsFn: func(ctx context.Context, orgID int64, old, new string, validate func(models.Provenance) bool, dryRun bool) ([]models.AlertRuleKey, []models.AlertRuleKey, error) {
				assertInTransaction(t, ctx)
				return nil, []models.AlertRuleKey{models.GenerateRuleKey(orgID)}, nil
			},
		}
		sut.ruleNotificationsStore = ruleStore

		_, err := sut.UpdateReceiver(context.Background(), &baseReceiver, nil, writer.GetOrgID(), writer)
		require.ErrorIs(t, err, ErrReceiverDependentResourcesProvenance)

		require.Len(t, ruleStore.Calls, 1)
		assert.Equal(t, "RenameReceiverInNotificationSettings", ruleStore.Calls[0].Method)
		assert.Equal(t, writer.OrgID, ruleStore.Calls[0].Args[1])
		assert.Equal(t, receiverName, ruleStore.Calls[0].Args[2])
		assert.Equal(t, newReceiverName, ruleStore.Calls[0].Args[3])
		assert.NotNil(t, ruleStore.Calls[0].Args[4])
		assert.Falsef(t, ruleStore.Calls[0].Args[5].(bool), "dryrun expected to be false")
	})
}

func TestReceiverServiceAC_Read(t *testing.T) {
	var orgId int64 = 1
	secretsService := fake_secrets.NewFakeSecretsService()

	admin := &user.SignedInUser{OrgID: orgId, OrgRole: org.RoleAdmin, Permissions: map[int64]map[string][]string{
		orgId: {
			accesscontrol.ActionAlertingNotificationsWrite: nil,
			accesscontrol.ActionAlertingNotificationsRead:  nil,
		},
	}}

	slackIntegration := models.IntegrationGen(models.IntegrationMuts.WithName("test receiver"), models.IntegrationMuts.WithValidConfig("slack"))
	emailIntegration := models.IntegrationGen(models.IntegrationMuts.WithName("test receiver"), models.IntegrationMuts.WithValidConfig("email"))
	recv1 := models.ReceiverGen(models.ReceiverMuts.WithName("receiver1"), models.ReceiverMuts.WithIntegrations(slackIntegration(), emailIntegration()))()
	recv2 := models.ReceiverGen(models.ReceiverMuts.WithName("receiver2"), models.ReceiverMuts.WithIntegrations(slackIntegration(), emailIntegration()))()
	recv3 := models.ReceiverGen(models.ReceiverMuts.WithName("receiver with a really long name that surpasses 40 characters"), models.ReceiverMuts.WithIntegrations(slackIntegration(), emailIntegration()))()
	allReceivers := func() []models.Receiver {
		return []models.Receiver{recv1, recv2, recv3}
	}
	testCases := []struct {
		name        string
		permissions map[string][]string
		existing    []models.Receiver

		visible                 []models.Receiver
		visibleWithProvisioning []models.Receiver
	}{
		{
			name:     "not authorized without permissions",
			existing: allReceivers(),
			visible:  nil,
		},
		{
			name:        "not authorized without receivers scope",
			permissions: map[string][]string{accesscontrol.ActionAlertingReceiversRead: nil},
			existing:    allReceivers(),
			visible:     nil,
		},
		{
			name:        "global legacy permissions - read all",
			permissions: map[string][]string{accesscontrol.ActionAlertingNotificationsRead: nil},
			existing:    allReceivers(),
			visible:     allReceivers(),
		},
		{
			name:        "global receivers permissions - read all",
			permissions: map[string][]string{accesscontrol.ActionAlertingReceiversRead: {ac.ScopeReceiversAll}},
			existing:    allReceivers(),
			visible:     allReceivers(),
		},
		{
			name: "single receivers permissions - read some",
			permissions: map[string][]string{accesscontrol.ActionAlertingReceiversRead: {
				ac.ScopeReceiversProvider.GetResourceScopeUID(recv1.UID),
				ac.ScopeReceiversProvider.GetResourceScopeUID(recv3.UID),
			}},
			existing: allReceivers(),
			visible:  []models.Receiver{recv1, recv3},
		},
		{
			name:        "global receivers secret permissions - read all",
			permissions: map[string][]string{accesscontrol.ActionAlertingReceiversReadSecrets: {ac.ScopeReceiversAll}},
			existing:    allReceivers(),
			visible:     allReceivers(),
		},
		{
			name: "single receivers secret permissions - read some",
			permissions: map[string][]string{accesscontrol.ActionAlertingReceiversReadSecrets: {
				ac.ScopeReceiversProvider.GetResourceScopeUID(recv1.UID),
				ac.ScopeReceiversProvider.GetResourceScopeUID(recv3.UID),
			}},
			existing: allReceivers(),
			visible:  []models.Receiver{recv1, recv3},
		},
		{
			name:                    "provisioning read applies to only provisioning",
			permissions:             map[string][]string{accesscontrol.ActionAlertingProvisioningRead: nil},
			existing:                allReceivers(),
			visible:                 nil,
			visibleWithProvisioning: allReceivers(),
		},
		{
			name:                    "provisioning read secrets applies to only provisioning",
			permissions:             map[string][]string{accesscontrol.ActionAlertingProvisioningReadSecrets: nil},
			existing:                allReceivers(),
			visible:                 nil,
			visibleWithProvisioning: allReceivers(),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			sut := createReceiverServiceSut(t, &secretsService)

			for _, recv := range tc.existing {
				_, err := sut.CreateReceiver(context.Background(), &recv, orgId, admin)
				require.NoError(t, err)
			}

			usr := &user.SignedInUser{OrgID: orgId, Permissions: map[int64]map[string][]string{
				orgId: tc.permissions,
			}}

			isVisible := func(uid string) bool {
				for _, recv := range tc.visible {
					if recv.UID == uid {
						return true
					}
				}
				return false
			}
			for _, recv := range allReceivers() {
				response, err := sut.GetReceiver(context.Background(), singleQ(orgId, recv.Name), usr)
				if isVisible(recv.UID) {
					require.NoErrorf(t, err, "receiver '%s' should be visible, but isn't", recv.Name)
					assert.NotNil(t, response)
				} else {
					assert.ErrorIsf(t, err, ac.ErrAuthorizationBase, "receiver '%s' should not be visible, but is", recv.Name)
				}
			}

			isVisibleInProvisioning := func(uid string) bool {
				if tc.visibleWithProvisioning == nil {
					return isVisible(uid)
				}
				for _, recv := range tc.visibleWithProvisioning {
					if recv.UID == uid {
						return true
					}
				}
				return false
			}
			sut.authz = ac.NewReceiverAccess[*models.Receiver](acimpl.ProvideAccessControl(featuremgmt.WithFeatures()), true)
			for _, recv := range allReceivers() {
				response, err := sut.GetReceiver(context.Background(), singleQ(orgId, recv.Name), usr)
				if isVisibleInProvisioning(recv.UID) {
					require.NoErrorf(t, err, "receiver '%s' should be visible, but isn't", recv.Name)
					assert.NotNil(t, response)
				} else {
					assert.ErrorIsf(t, err, ac.ErrAuthorizationBase, "receiver '%s' should not be visible, but is", recv.Name)
				}
			}
		})
	}
}

func TestReceiverServiceAC_Create(t *testing.T) {
	var orgId int64 = 1
	secretsService := fake_secrets.NewFakeSecretsService()

	slackIntegration := models.IntegrationGen(models.IntegrationMuts.WithName("test receiver"), models.IntegrationMuts.WithValidConfig("slack"))
	emailIntegration := models.IntegrationGen(models.IntegrationMuts.WithName("test receiver"), models.IntegrationMuts.WithValidConfig("email"))
	recv1 := models.ReceiverGen(models.ReceiverMuts.WithName("receiver1"), models.ReceiverMuts.WithIntegrations(slackIntegration(), emailIntegration()))()
	recv2 := models.ReceiverGen(models.ReceiverMuts.WithName("receiver2"), models.ReceiverMuts.WithIntegrations(slackIntegration(), emailIntegration()))()
	recv3 := models.ReceiverGen(models.ReceiverMuts.WithName("receiver with a really long name that surpasses 40 characters"), models.ReceiverMuts.WithIntegrations(slackIntegration(), emailIntegration()))()
	allReceivers := func() []models.Receiver {
		return []models.Receiver{recv1, recv2, recv3}
	}
	testCases := []struct {
		name        string
		permissions map[string][]string

		hasAccess []models.Receiver
	}{
		{
			name:      "not authorized without permissions",
			hasAccess: nil,
		},
		{
			name:        "global legacy permissions - authorized without read",
			permissions: map[string][]string{accesscontrol.ActionAlertingNotificationsWrite: nil},
			hasAccess:   allReceivers(),
		},
		{
			name:        "receivers permissions - authorized without read",
			permissions: map[string][]string{accesscontrol.ActionAlertingReceiversCreate: nil},
			hasAccess:   allReceivers(),
		},
		{
			name:        "global legacy permissions - create all",
			permissions: map[string][]string{accesscontrol.ActionAlertingNotificationsWrite: nil, accesscontrol.ActionAlertingNotificationsRead: nil},
			hasAccess:   allReceivers(),
		},
		{
			name:        "receivers permissions - create all",
			permissions: map[string][]string{accesscontrol.ActionAlertingReceiversCreate: nil, accesscontrol.ActionAlertingReceiversRead: nil},
			hasAccess:   allReceivers(),
		},
		{
			name: "receivers mixed global read permissions - create all",
			permissions: map[string][]string{
				accesscontrol.ActionAlertingReceiversCreate:   nil,
				accesscontrol.ActionAlertingNotificationsRead: nil,
			},
			hasAccess: allReceivers(),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			sut := createReceiverServiceSut(t, &secretsService)

			usr := &user.SignedInUser{OrgID: orgId, Permissions: map[int64]map[string][]string{
				orgId: tc.permissions,
			}}

			hasAccess := func(uid string) bool {
				for _, recv := range tc.hasAccess {
					if recv.UID == uid {
						return true
					}
				}
				return false
			}
			for _, recv := range allReceivers() {
				response, err := sut.CreateReceiver(context.Background(), &recv, orgId, usr)
				if hasAccess(recv.UID) {
					require.NoErrorf(t, err, "should have access to receiver '%s', but doesn't", recv.Name)
					assert.NotNil(t, response)
				} else {
					assert.ErrorIsf(t, err, ac.ErrAuthorizationBase, "should not have access to receiver '%s', but does", recv.Name)
				}
			}
		})
	}
}

func TestReceiverServiceAC_Update(t *testing.T) {
	var orgId int64 = 1
	secretsService := fake_secrets.NewFakeSecretsService()

	admin := &user.SignedInUser{OrgID: orgId, OrgRole: org.RoleAdmin, Permissions: map[int64]map[string][]string{
		orgId: {
			accesscontrol.ActionAlertingNotificationsWrite: nil,
			accesscontrol.ActionAlertingNotificationsRead:  nil,
		},
	}}

	slackIntegration := models.IntegrationGen(models.IntegrationMuts.WithName("test receiver"), models.IntegrationMuts.WithValidConfig("slack"))
	emailIntegration := models.IntegrationGen(models.IntegrationMuts.WithName("test receiver"), models.IntegrationMuts.WithValidConfig("email"))
	recv1 := models.ReceiverGen(models.ReceiverMuts.WithName("receiver1"), models.ReceiverMuts.WithIntegrations(slackIntegration(), emailIntegration()))()
	recv2 := models.ReceiverGen(models.ReceiverMuts.WithName("receiver2"), models.ReceiverMuts.WithIntegrations(slackIntegration(), emailIntegration()))()
	recv3 := models.ReceiverGen(models.ReceiverMuts.WithName("receiver with a really long name that surpasses 40 characters"), models.ReceiverMuts.WithIntegrations(slackIntegration(), emailIntegration()))()
	allReceivers := func() []models.Receiver {
		return []models.Receiver{recv1, recv2, recv3}
	}
	testCases := []struct {
		name        string
		permissions map[string][]string
		existing    []models.Receiver

		hasAccess []models.Receiver
	}{
		{
			name:      "not authorized without permissions",
			existing:  allReceivers(),
			hasAccess: nil,
		},
		{
			name:        "not authorized without receivers scope",
			permissions: map[string][]string{accesscontrol.ActionAlertingReceiversUpdate: nil},
			existing:    allReceivers(),
			hasAccess:   nil,
		},
		{
			name:        "global legacy permissions - not authorized without read",
			permissions: map[string][]string{accesscontrol.ActionAlertingNotificationsWrite: nil},
			existing:    allReceivers(),
			hasAccess:   nil,
		},
		{
			name:        "global receivers permissions - not authorized without read",
			permissions: map[string][]string{accesscontrol.ActionAlertingReceiversUpdate: {ac.ScopeReceiversAll}},
			existing:    allReceivers(),
			hasAccess:   nil,
		},
		{
			name: "single receivers permissions - not authorized without read",
			permissions: map[string][]string{accesscontrol.ActionAlertingReceiversUpdate: {
				ac.ScopeReceiversProvider.GetResourceScopeUID(recv1.UID),
				ac.ScopeReceiversProvider.GetResourceScopeUID(recv3.UID),
			}},
			existing:  allReceivers(),
			hasAccess: nil,
		},
		{
			name:        "global legacy permissions - update all",
			permissions: map[string][]string{accesscontrol.ActionAlertingNotificationsWrite: nil, accesscontrol.ActionAlertingNotificationsRead: nil},
			existing:    allReceivers(),
			hasAccess:   allReceivers(),
		},
		{
			name:        "global receivers permissions - update all",
			permissions: map[string][]string{accesscontrol.ActionAlertingReceiversUpdate: {ac.ScopeReceiversAll}, accesscontrol.ActionAlertingReceiversRead: {ac.ScopeReceiversAll}},
			existing:    allReceivers(),
			hasAccess:   allReceivers(),
		},
		{
			name: "single receivers permissions - update some",
			permissions: map[string][]string{
				accesscontrol.ActionAlertingReceiversUpdate: {
					ac.ScopeReceiversProvider.GetResourceScopeUID(recv1.UID),
					ac.ScopeReceiversProvider.GetResourceScopeUID(recv3.UID),
				},
				accesscontrol.ActionAlertingReceiversRead: {
					ac.ScopeReceiversProvider.GetResourceScopeUID(recv1.UID),
					ac.ScopeReceiversProvider.GetResourceScopeUID(recv3.UID),
				},
			},
			existing:  allReceivers(),
			hasAccess: []models.Receiver{recv1, recv3},
		},
		{
			name: "single receivers mixed read permissions - update some",
			permissions: map[string][]string{
				accesscontrol.ActionAlertingReceiversUpdate: {
					ac.ScopeReceiversProvider.GetResourceScopeUID(recv1.UID),
					ac.ScopeReceiversProvider.GetResourceScopeUID(recv3.UID),
				},
				accesscontrol.ActionAlertingReceiversRead: {
					ac.ScopeReceiversProvider.GetResourceScopeUID(recv2.UID),
					ac.ScopeReceiversProvider.GetResourceScopeUID(recv3.UID),
				},
			},
			existing:  allReceivers(),
			hasAccess: []models.Receiver{recv3},
		},
		{
			name: "single receivers mixed global read permissions - update some",
			permissions: map[string][]string{
				accesscontrol.ActionAlertingReceiversUpdate: {
					ac.ScopeReceiversProvider.GetResourceScopeUID(recv1.UID),
					ac.ScopeReceiversProvider.GetResourceScopeUID(recv3.UID),
				},
				accesscontrol.ActionAlertingNotificationsRead: nil,
			},
			existing:  allReceivers(),
			hasAccess: []models.Receiver{recv1, recv3},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			sut := createReceiverServiceSut(t, &secretsService)

			versions := map[string]string{}
			for _, recv := range tc.existing {
				created, err := sut.CreateReceiver(context.Background(), &recv, orgId, admin)
				require.NoError(t, err)
				versions[recv.UID] = created.Version
			}

			usr := &user.SignedInUser{OrgID: orgId, Permissions: map[int64]map[string][]string{
				orgId: tc.permissions,
			}}

			hasAccess := func(uid string) bool {
				for _, recv := range tc.hasAccess {
					if recv.UID == uid {
						return true
					}
				}
				return false
			}
			for _, recv := range allReceivers() {
				clone := recv.Clone()
				clone.Version = versions[recv.UID]
				response, err := sut.UpdateReceiver(context.Background(), &clone, nil, orgId, usr)
				if hasAccess(clone.UID) {
					require.NoErrorf(t, err, "should have access to receiver '%s', but doesn't", clone.Name)
					assert.NotNil(t, response)
				} else {
					assert.ErrorIsf(t, err, ac.ErrAuthorizationBase, "should not have access to receiver '%s', but does", clone.Name)
				}
			}
		})
	}
}

func TestReceiverServiceAC_Delete(t *testing.T) {
	var orgId int64 = 1
	secretsService := fake_secrets.NewFakeSecretsService()

	admin := &user.SignedInUser{OrgID: orgId, OrgRole: org.RoleAdmin, Permissions: map[int64]map[string][]string{
		orgId: {
			accesscontrol.ActionAlertingNotificationsWrite: nil,
			accesscontrol.ActionAlertingNotificationsRead:  nil,
		},
	}}

	slackIntegration := models.IntegrationGen(models.IntegrationMuts.WithName("test receiver"), models.IntegrationMuts.WithValidConfig("slack"))
	emailIntegration := models.IntegrationGen(models.IntegrationMuts.WithName("test receiver"), models.IntegrationMuts.WithValidConfig("email"))
	recv1 := models.ReceiverGen(models.ReceiverMuts.WithName("receiver1"), models.ReceiverMuts.WithIntegrations(slackIntegration(), emailIntegration()))()
	recv2 := models.ReceiverGen(models.ReceiverMuts.WithName("receiver2"), models.ReceiverMuts.WithIntegrations(slackIntegration(), emailIntegration()))()
	recv3 := models.ReceiverGen(models.ReceiverMuts.WithName("receiver with a really long name that surpasses 40 characters"), models.ReceiverMuts.WithIntegrations(slackIntegration(), emailIntegration()))()
	allReceivers := func() []models.Receiver {
		return []models.Receiver{recv1, recv2, recv3}
	}
	testCases := []struct {
		name        string
		permissions map[string][]string
		existing    []models.Receiver

		hasAccess []models.Receiver
	}{
		{
			name:      "not authorized without permissions",
			existing:  allReceivers(),
			hasAccess: nil,
		},
		{
			name:        "not authorized without receivers scope",
			permissions: map[string][]string{accesscontrol.ActionAlertingReceiversDelete: nil},
			existing:    allReceivers(),
			hasAccess:   nil,
		},
		{
			name:        "global legacy permissions - not authorized without read",
			permissions: map[string][]string{accesscontrol.ActionAlertingNotificationsWrite: nil},
			existing:    allReceivers(),
			hasAccess:   nil,
		},
		{
			name:        "global receivers permissions - not authorized without read",
			permissions: map[string][]string{accesscontrol.ActionAlertingReceiversDelete: {ac.ScopeReceiversAll}},
			existing:    allReceivers(),
			hasAccess:   nil,
		},
		{
			name: "single receivers permissions - not authorized without read",
			permissions: map[string][]string{accesscontrol.ActionAlertingReceiversDelete: {
				ac.ScopeReceiversProvider.GetResourceScopeUID(recv1.UID),
				ac.ScopeReceiversProvider.GetResourceScopeUID(recv3.UID),
			}},
			existing:  allReceivers(),
			hasAccess: nil,
		},
		{
			name:        "global legacy permissions - delete all",
			permissions: map[string][]string{accesscontrol.ActionAlertingNotificationsWrite: nil, accesscontrol.ActionAlertingNotificationsRead: nil},
			existing:    allReceivers(),
			hasAccess:   allReceivers(),
		},
		{
			name:        "global receivers permissions - delete all",
			permissions: map[string][]string{accesscontrol.ActionAlertingReceiversDelete: {ac.ScopeReceiversAll}, accesscontrol.ActionAlertingReceiversRead: {ac.ScopeReceiversAll}},
			existing:    allReceivers(),
			hasAccess:   allReceivers(),
		},
		{
			name: "single receivers permissions - delete some",
			permissions: map[string][]string{
				accesscontrol.ActionAlertingReceiversDelete: {
					ac.ScopeReceiversProvider.GetResourceScopeUID(recv1.UID),
					ac.ScopeReceiversProvider.GetResourceScopeUID(recv3.UID),
				},
				accesscontrol.ActionAlertingReceiversRead: {
					ac.ScopeReceiversProvider.GetResourceScopeUID(recv1.UID),
					ac.ScopeReceiversProvider.GetResourceScopeUID(recv3.UID),
				},
			},
			existing:  allReceivers(),
			hasAccess: []models.Receiver{recv1, recv3},
		},
		{
			name: "single receivers mixed read permissions - delete some",
			permissions: map[string][]string{
				accesscontrol.ActionAlertingReceiversDelete: {
					ac.ScopeReceiversProvider.GetResourceScopeUID(recv1.UID),
					ac.ScopeReceiversProvider.GetResourceScopeUID(recv3.UID),
				},
				accesscontrol.ActionAlertingReceiversRead: {
					ac.ScopeReceiversProvider.GetResourceScopeUID(recv2.UID),
					ac.ScopeReceiversProvider.GetResourceScopeUID(recv3.UID),
				},
			},
			existing:  allReceivers(),
			hasAccess: []models.Receiver{recv3},
		},
		{
			name: "single receivers mixed global read permissions - delete some",
			permissions: map[string][]string{
				accesscontrol.ActionAlertingReceiversDelete: {
					ac.ScopeReceiversProvider.GetResourceScopeUID(recv1.UID),
					ac.ScopeReceiversProvider.GetResourceScopeUID(recv3.UID),
				},
				accesscontrol.ActionAlertingNotificationsRead: nil,
			},
			existing:  allReceivers(),
			hasAccess: []models.Receiver{recv1, recv3},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			sut := createReceiverServiceSut(t, &secretsService)

			versions := map[string]string{}
			for _, recv := range tc.existing {
				created, err := sut.CreateReceiver(context.Background(), &recv, orgId, admin)
				require.NoError(t, err)
				versions[recv.UID] = created.Version
			}

			usr := &user.SignedInUser{OrgID: orgId, Permissions: map[int64]map[string][]string{
				orgId: tc.permissions,
			}}

			hasAccess := func(uid string) bool {
				for _, recv := range tc.hasAccess {
					if recv.UID == uid {
						return true
					}
				}
				return false
			}
			for _, recv := range allReceivers() {
				err := sut.DeleteReceiver(context.Background(), recv.UID, models.ProvenanceNone, versions[recv.UID], orgId, usr)
				if hasAccess(recv.UID) {
					require.NoErrorf(t, err, "should have access to receiver '%s', but doesn't", recv.Name)
				} else {
					assert.ErrorIsf(t, err, ac.ErrAuthorizationBase, "should not have access to receiver '%s', but does", recv.Name)
				}
			}
		})
	}
}

func TestReceiverService_InUseMetadata(t *testing.T) {
	secretsService := fake_secrets.NewFakeSecretsService()

	admin := &user.SignedInUser{OrgID: 1, OrgRole: org.RoleAdmin, Permissions: map[int64]map[string][]string{
		1: {
			accesscontrol.ActionAlertingNotificationsWrite: nil,
			accesscontrol.ActionAlertingNotificationsRead:  nil,
		},
	}}

	for _, tc := range []struct {
		name             string
		user             identity.Requester
		storeRoute       definitions.Route
		storeSettings    map[models.AlertRuleKey][]models.NotificationSettings
		existing         []*models.Receiver
		expectedMetadata map[string]models.ReceiverMetadata
	}{
		{
			name: "mixed metadata",
			user: admin,
			existing: []*models.Receiver{
				util.Pointer(models.ReceiverGen(models.ReceiverMuts.WithName("receiver1"))()),
				util.Pointer(models.ReceiverGen(models.ReceiverMuts.WithName("receiver2"))()),
				util.Pointer(models.ReceiverGen(models.ReceiverMuts.WithName("receiver3"))()),
				util.Pointer(models.ReceiverGen(models.ReceiverMuts.WithName("receiver4"))()),
			},
			storeSettings: map[models.AlertRuleKey][]models.NotificationSettings{
				{OrgID: 1, UID: "rule1uid"}: {
					models.NotificationSettingsGen(models.NSMuts.WithReceiver("receiver1"))(),
					models.NotificationSettingsGen(models.NSMuts.WithReceiver("receiver2"))(),
				},
				{OrgID: 1, UID: "rule2uid"}: {
					models.NotificationSettingsGen(models.NSMuts.WithReceiver("receiver2"))(),
					models.NotificationSettingsGen(models.NSMuts.WithReceiver("receiver3"))(),
				},
			},
			storeRoute: definitions.Route{
				Receiver: "receiver1",
				Routes: []*definitions.Route{
					{Receiver: "receiver2"},
					{Receiver: "receiver3"},
					{
						Receiver: "receiver4",
						Routes: []*definitions.Route{
							{Receiver: "receiver1"},
							{Receiver: "receiver3"},
						},
					},
				},
			},
			expectedMetadata: map[string]models.ReceiverMetadata{
				legacy_storage.NameToUid("receiver1"): {
					InUseByRules:  []models.AlertRuleKey{{OrgID: 1, UID: "rule1uid"}},
					InUseByRoutes: 2,
				},
				legacy_storage.NameToUid("receiver2"): {
					InUseByRules:  []models.AlertRuleKey{{OrgID: 1, UID: "rule1uid"}, {OrgID: 1, UID: "rule2uid"}},
					InUseByRoutes: 1,
				},
				legacy_storage.NameToUid("receiver3"): {
					InUseByRules:  []models.AlertRuleKey{{OrgID: 1, UID: "rule2uid"}},
					InUseByRoutes: 2,
				},
				legacy_storage.NameToUid("receiver4"): {
					InUseByRules:  []models.AlertRuleKey{},
					InUseByRoutes: 1,
				},
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := &fakeAlertRuleNotificationStore{}
			store.ListNotificationSettingsFn = func(ctx context.Context, q models.ListNotificationSettingsQuery) (map[models.AlertRuleKey][]models.NotificationSettings, error) {
				return tc.storeSettings, nil
			}

			sut := createReceiverServiceSut(t, &secretsService)
			sut.ruleNotificationsStore = store

			for _, recv := range tc.existing {
				_, err := sut.CreateReceiver(context.Background(), recv, tc.user.GetOrgID(), tc.user)
				require.NoError(t, err)
			}

			// Create route after receivers as they will be referenced.
			revision, err := sut.cfgStore.Get(context.Background(), tc.user.GetOrgID())
			require.NoError(t, err)
			revision.Config.AlertmanagerConfig.Route = &tc.storeRoute
			err = sut.cfgStore.Save(context.Background(), revision, tc.user.GetOrgID())
			require.NoError(t, err)

			metadata, err := sut.InUseMetadata(context.Background(), tc.user.GetOrgID(), tc.existing...)
			require.NoError(t, err)

			assert.Lenf(t, metadata, len(tc.expectedMetadata), "unexpected metadata length")
			for _, recv := range tc.existing {
				expected, ok := tc.expectedMetadata[recv.UID]
				assert.Truef(t, ok, "missing metadata for receiver uid: %q, name: %q", recv.UID, recv.Name)
				assert.ElementsMatch(t, expected.InUseByRules, metadata[recv.UID].InUseByRules, "unexpected rules metadata for receiver uid: %q, name: %q", recv.UID, recv.Name)
				assert.Equalf(t, expected.InUseByRoutes, metadata[recv.UID].InUseByRoutes, "unexpected routes metadata for receiver uid: %q, name: %q", recv.UID, recv.Name)
			}
		})
	}
}

func createReceiverServiceSut(t *testing.T, encryptSvc secretService) *ReceiverService {
	cfg := createEncryptedConfig(t, encryptSvc)
	store := fakes.NewFakeAlertmanagerConfigStore(cfg)
	xact := newNopTransactionManager()
	provisioningStore := fakes.NewFakeProvisioningStore()

	return NewReceiverService(
		ac.NewReceiverAccess[*models.Receiver](acimpl.ProvideAccessControl(featuremgmt.WithFeatures()), false),
		legacy_storage.NewAlertmanagerConfigStore(store, NewExtraConfigsCrypto(encryptSvc)),
		provisioningStore,
		&fakeAlertRuleNotificationStore{},
		encryptSvc,
		xact,
		log.NewNopLogger(),
		fakes.NewFakeReceiverPermissionsService(),
		tracing.InitializeTracerForTest(),
	)
}

func createEncryptedConfig(t *testing.T, secretService secretService) string {
	c := &definitions.PostableUserConfig{}
	err := json.Unmarshal([]byte(defaultAlertmanagerConfigJSON), c)
	require.NoError(t, err)
	err = EncryptReceiverConfigs(c.AlertmanagerConfig.Receivers, func(ctx context.Context, payload []byte) ([]byte, error) {
		return secretService.Encrypt(ctx, payload, secrets.WithoutScope())
	})
	require.NoError(t, err)
	bytes, err := json.Marshal(c)
	require.NoError(t, err)
	return string(bytes)
}

func singleQ(orgID int64, name string) models.GetReceiverQuery {
	return models.GetReceiverQuery{
		OrgID: orgID,
		Name:  name,
	}
}

func multiQ(orgID int64, names ...string) models.GetReceiversQuery {
	return models.GetReceiversQuery{
		OrgID: orgID,
		Names: names,
	}
}

const defaultAlertmanagerConfigJSON = `
{
	"template_files": null,
	"alertmanager_config": {
		"route": {
			"receiver": "grafana-default-email",
			"group_by": [
				"..."
			],
			"routes": [{
				"receiver": "grafana-default-email",
				"object_matchers": [["a", "=", "b"]]
			}]
		},
		"templates": null,
		"receivers": [{
			"name": "grafana-default-email",
			"grafana_managed_receiver_configs": [{
				"uid": "UID1",
				"name": "grafana-default-email",
				"type": "email",
				"disableResolveMessage": false,
				"settings": {
					"addresses": "\u003cexample@email.com\u003e"
				},
				"secureFields": {}
			}]
		}, {
			"name": "slack receiver",
			"grafana_managed_receiver_configs": [{
				"uid": "UID2",
				"name": "slack receiver",
				"type": "slack",
				"disableResolveMessage": false,
				"settings": {},
				"secureSettings": {"url":"secure url"}
			}]
		}]
	}
}
`

type NopTransactionManager struct{}

func newNopTransactionManager() *NopTransactionManager {
	return &NopTransactionManager{}
}

func (n *NopTransactionManager) InTransaction(ctx context.Context, work func(ctx context.Context) error) error {
	return work(context.WithValue(ctx, NopTransactionManager{}, struct{}{}))
}

func assertInTransaction(t *testing.T, ctx context.Context) {
	assert.Truef(t, ctx.Value(NopTransactionManager{}) != nil, "Expected to be executed in transaction but there is none")
}
