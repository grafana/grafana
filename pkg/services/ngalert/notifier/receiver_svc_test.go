package notifier

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
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

func TestReceiverService_GetReceiver(t *testing.T) {
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

func TestReceiverService_GetReceivers(t *testing.T) {
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

func TestReceiverService_DecryptRedact(t *testing.T) {
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
					} else {
						require.Equal(t, definitions.RedactedValue, res.Integrations[0].Settings["url"])
					}
				}
			})
		}
	}
}

func TestReceiverService_Delete(t *testing.T) {
	secretsService := fake_secrets.NewFakeSecretsService()

	redactedUser := &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
		1: {
			accesscontrol.ActionAlertingNotificationsRead: nil,
		},
	}}

	slackIntegration := models.IntegrationGen(models.IntegrationMuts.WithName("test receiver"), models.IntegrationMuts.WithValidConfig("slack"))()
	emailIntegration := models.IntegrationGen(models.IntegrationMuts.WithName("test receiver"), models.IntegrationMuts.WithValidConfig("email"))()
	baseReceiver := models.ReceiverGen(models.ReceiverMuts.WithName("test receiver"), models.ReceiverMuts.WithIntegrations(slackIntegration))()

	for _, tc := range []struct {
		name             string
		user             identity.Requester
		deleteUID        string
		callerProvenance definitions.Provenance
		version          string
		existing         *models.Receiver
		expectedErr      error
	}{
		{
			name:      "service deletes receiver",
			user:      redactedUser,
			deleteUID: baseReceiver.UID,
			existing:  util.Pointer(baseReceiver.Clone()),
		},
		{
			name:      "service deletes receiver with multiple integrations",
			user:      redactedUser,
			deleteUID: baseReceiver.UID,
			existing:  util.Pointer(models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithIntegrations(slackIntegration, emailIntegration))),
		},
		{
			name:             "service deletes receiver with provenance",
			user:             redactedUser,
			deleteUID:        baseReceiver.UID,
			callerProvenance: definitions.Provenance(models.ProvenanceAPI),
			existing:         util.Pointer(models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithProvenance(models.ProvenanceAPI), models.ReceiverMuts.WithIntegrations(slackIntegration, emailIntegration))),
		},
		{
			name:      "non-existing receiver doesn't fail",
			user:      redactedUser,
			deleteUID: "non-existent",
		},
		{
			name:        "delete receiver used by route fails",
			user:        redactedUser,
			deleteUID:   legacy_storage.NameToUid("grafana-default-email"),
			version:     "1fd7897966a2adc5", // Correct version for grafana-default-email.
			expectedErr: makeReceiverInUseErr(true, nil),
		},
		{
			name:             "delete provisioning provenance fails when caller is ProvenanceNone",
			user:             redactedUser,
			deleteUID:        baseReceiver.UID,
			callerProvenance: definitions.Provenance(models.ProvenanceNone),
			existing:         util.Pointer(models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithProvenance(models.ProvenanceFile))),
			expectedErr:      validation.MakeErrProvenanceChangeNotAllowed(models.ProvenanceFile, models.ProvenanceNone),
		},
		{
			name:             "delete provisioning provenance fails when caller is a different type", // TODO: This should fail once we move from lenient to strict validation.
			user:             redactedUser,
			deleteUID:        baseReceiver.UID,
			callerProvenance: definitions.Provenance(models.ProvenanceFile),
			existing:         util.Pointer(models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithProvenance(models.ProvenanceAPI))),
			//expectedErr:      validation.MakeErrProvenanceChangeNotAllowed(models.ProvenanceAPI, models.ProvenanceFile),
		},
		{
			name:        "delete receiver with optimistic version mismatch fails",
			user:        redactedUser,
			deleteUID:   baseReceiver.UID,
			existing:    util.Pointer(baseReceiver.Clone()),
			version:     "wrong version",
			expectedErr: ErrVersionConflict,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			sut := createReceiverServiceSut(t, &secretsService)

			if tc.existing != nil {
				created, err := sut.CreateReceiver(context.Background(), tc.existing, tc.user.GetOrgID())
				require.NoError(t, err)

				if tc.version == "" {
					tc.version = created.Version
				}
			}

			err := sut.DeleteReceiver(context.Background(), tc.deleteUID, tc.user.GetOrgID(), tc.callerProvenance, tc.version)
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
			_, err = sut.GetReceiver(context.Background(), q, redactedUser)
			assert.ErrorIs(t, err, legacy_storage.ErrReceiverNotFound)

			provenances, err := sut.provisioningStore.GetProvenances(context.Background(), tc.user.GetOrgID(), (&definitions.EmbeddedContactPoint{}).ResourceType())
			require.NoError(t, err)
			assert.Len(t, provenances, 0)
		})
	}
}

func TestReceiverService_Create(t *testing.T) {
	secretsService := fake_secrets.NewFakeSecretsService()

	redactedUser := &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
		1: {
			accesscontrol.ActionAlertingNotificationsRead: nil,
		},
	}}
	decryptUser := &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
		1: {
			accesscontrol.ActionAlertingReceiversReadSecrets: {ac.ScopeReceiversAll},
		},
	}}

	slackIntegration := models.IntegrationGen(models.IntegrationMuts.WithName("test receiver"), models.IntegrationMuts.WithValidConfig("slack"))()
	emailIntegration := models.IntegrationGen(models.IntegrationMuts.WithName("test receiver"), models.IntegrationMuts.WithValidConfig("email"))()
	baseReceiver := models.ReceiverGen(models.ReceiverMuts.WithName("test receiver"), models.ReceiverMuts.WithIntegrations(slackIntegration))()

	for _, tc := range []struct {
		name                string
		user                identity.Requester
		receiver            models.Receiver
		expectedCreate      models.Receiver
		expectedErr         error
		expectedProvenances map[string]models.Provenance
	}{
		{
			name:                "service creates receiver",
			user:                redactedUser,
			receiver:            baseReceiver.Clone(),
			expectedCreate:      models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.Encrypted(models.Base64Enrypt)),
			expectedProvenances: map[string]models.Provenance{slackIntegration.UID: models.ProvenanceNone},
		},
		{
			name:                "service creates receiver with multiple integrations",
			user:                redactedUser,
			receiver:            models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithIntegrations(slackIntegration, emailIntegration)),
			expectedCreate:      models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithIntegrations(slackIntegration, emailIntegration), models.ReceiverMuts.Encrypted(models.Base64Enrypt)),
			expectedProvenances: map[string]models.Provenance{slackIntegration.UID: models.ProvenanceNone, emailIntegration.UID: models.ProvenanceNone},
		},
		{
			name:                "service creates receiver with provenance",
			user:                redactedUser,
			receiver:            models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithProvenance(models.ProvenanceAPI), models.ReceiverMuts.WithIntegrations(slackIntegration, emailIntegration)),
			expectedCreate:      models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithProvenance(models.ProvenanceAPI), models.ReceiverMuts.WithIntegrations(slackIntegration, emailIntegration), models.ReceiverMuts.Encrypted(models.Base64Enrypt)),
			expectedProvenances: map[string]models.Provenance{slackIntegration.UID: models.ProvenanceAPI, emailIntegration.UID: models.ProvenanceAPI},
		},
		{
			name:        "existing receiver fails",
			user:        redactedUser,
			receiver:    models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithName("grafana-default-email")),
			expectedErr: legacy_storage.ErrReceiverExists,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			sut := createReceiverServiceSut(t, &secretsService)

			created, err := sut.CreateReceiver(context.Background(), &tc.receiver, tc.user.GetOrgID())
			if tc.expectedErr == nil {
				require.NoError(t, err)
			} else {
				assert.ErrorIs(t, err, tc.expectedErr)
				return
			}

			assert.Equal(t, tc.expectedCreate, *created)

			// Ensure receiver saved to store is correct.
			q := models.GetReceiverQuery{OrgID: tc.user.GetOrgID(), Name: tc.receiver.Name, Decrypt: true}
			stored, err := sut.GetReceiver(context.Background(), q, decryptUser)
			require.NoError(t, err)
			decrypted := models.CopyReceiverWith(tc.expectedCreate, models.ReceiverMuts.Decrypted(models.Base64Decrypt))
			decrypted.Version = tc.expectedCreate.Version // Version is calculated before decryption.
			assert.Equal(t, decrypted, *stored)

			provenances, err := sut.provisioningStore.GetProvenances(context.Background(), tc.user.GetOrgID(), (&definitions.EmbeddedContactPoint{}).ResourceType())
			require.NoError(t, err)
			assert.Equal(t, tc.expectedProvenances, provenances)
		})
	}
}

func TestReceiverService_Update(t *testing.T) {
	secretsService := fake_secrets.NewFakeSecretsService()

	redactedUser := &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
		1: {
			accesscontrol.ActionAlertingNotificationsRead: nil,
		},
	}}
	decryptUser := &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
		1: {
			accesscontrol.ActionAlertingReceiversReadSecrets: {ac.ScopeReceiversAll},
		},
	}}

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
			user: redactedUser,
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
			name: "doesn't copy existing unsecure fields",
			user: redactedUser,
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
			user:     redactedUser,
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
			user:     redactedUser,
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
			user:        redactedUser,
			receiver:    models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithProvenance(models.ProvenanceNone)),
			existing:    util.Pointer(models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithProvenance(models.ProvenanceFile))),
			expectedErr: validation.MakeErrProvenanceChangeNotAllowed(models.ProvenanceFile, models.ProvenanceNone),
		},
		{
			name:     "changing provenance from one type to another fails", // TODO: This should fail once we move from lenient to strict validation.
			user:     redactedUser,
			receiver: models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithProvenance(models.ProvenanceAPI)),
			existing: util.Pointer(models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithProvenance(models.ProvenanceFile))),
			//expectedErr: validation.MakeErrProvenanceChangeNotAllowed(models.ProvenanceFile, models.ProvenanceAPI),
			expectedUpdate: models.CopyReceiverWith(baseReceiver,
				models.ReceiverMuts.WithProvenance(models.ProvenanceAPI),
				rm.Encrypted(models.Base64Enrypt)),
			expectedProvenances: map[string]models.Provenance{slackIntegration.UID: models.ProvenanceAPI},
		},
		{
			name:        "update receiver with optimistic version mismatch fails",
			user:        redactedUser,
			receiver:    baseReceiver.Clone(),
			version:     "wrong version",
			existing:    util.Pointer(baseReceiver.Clone()),
			expectedErr: ErrVersionConflict,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			sut := createReceiverServiceSut(t, &secretsService)

			if tc.existing != nil {
				created, err := sut.CreateReceiver(context.Background(), tc.existing, tc.user.GetOrgID())
				require.NoError(t, err)

				if tc.version == "" {
					tc.version = created.Version
				}
			}

			tc.receiver.Version = tc.version
			updated, err := sut.UpdateReceiver(context.Background(), &tc.receiver, tc.secureFields, tc.user.GetOrgID())
			if tc.expectedErr == nil {
				require.NoError(t, err)
			} else {
				assert.ErrorIs(t, err, tc.expectedErr)
				return
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

func TestReceiverServiceAC_Read(t *testing.T) {
	var orgId int64 = 1
	secretsService := fake_secrets.NewFakeSecretsService()

	admin := &user.SignedInUser{OrgID: orgId, OrgRole: org.RoleAdmin}

	slackIntegration := models.IntegrationGen(models.IntegrationMuts.WithName("test receiver"), models.IntegrationMuts.WithValidConfig("slack"))()
	emailIntegration := models.IntegrationGen(models.IntegrationMuts.WithName("test receiver"), models.IntegrationMuts.WithValidConfig("email"))()
	baseReceiver := models.ReceiverGen(models.ReceiverMuts.WithIntegrations(slackIntegration, emailIntegration))()
	recv1 := models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithName("receiver1"))
	recv2 := models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithName("receiver2"))
	recv3 := models.CopyReceiverWith(baseReceiver, models.ReceiverMuts.WithName("receiver3"))
	allReceivers := func() []models.Receiver {
		return []models.Receiver{recv1, recv2, recv3}
	}
	testCases := []struct {
		name        string
		permissions map[string][]string
		existing    []models.Receiver

		visible []models.Receiver
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
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			sut := createReceiverServiceSut(t, &secretsService)

			for _, recv := range tc.existing {
				_, err := sut.CreateReceiver(context.Background(), &recv, admin.GetOrgID())
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
					require.NoErrorf(t, err, "receiver %s should be visible, but isn't", recv.Name)
					assert.NotNil(t, response)
				} else {
					assert.ErrorIsf(t, err, ac.ErrAuthorizationBase, "receiver %s should not be visible, but is", recv.Name)
				}
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
		ac.NewReceiverAccess[*models.Receiver](acimpl.ProvideAccessControl(featuremgmt.WithFeatures(), zanzana.NewNoopClient()), false),
		legacy_storage.NewAlertmanagerConfigStore(store),
		provisioningStore,
		encryptSvc,
		xact,
		log.NewNopLogger(),
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
