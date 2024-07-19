package notifier

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning/validation"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	"github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestReceiverService_GetReceiver(t *testing.T) {
	sqlStore := db.InitTestDB(t)
	secretsService := manager.SetupTestService(t, database.ProvideSecretsStore(sqlStore))

	redactedUser := &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
		1: {
			accesscontrol.ActionAlertingProvisioningRead: nil,
		},
	}}

	t.Run("service gets receiver from AM config", func(t *testing.T) {
		sut := createReceiverServiceSut(t, secretsService)

		Receiver, err := sut.GetReceiver(context.Background(), singleQ(1, "slack receiver"), redactedUser)
		require.NoError(t, err)
		require.Equal(t, "slack receiver", Receiver.Name)
		require.Len(t, Receiver.GrafanaManagedReceivers, 1)
		require.Equal(t, "UID2", Receiver.GrafanaManagedReceivers[0].UID)
	})

	t.Run("service returns error when receiver does not exist", func(t *testing.T) {
		sut := createReceiverServiceSut(t, secretsService)

		_, err := sut.GetReceiver(context.Background(), singleQ(1, "nonexistent"), redactedUser)
		require.ErrorIs(t, err, ErrNotFound)
	})
}

func TestReceiverService_GetReceivers(t *testing.T) {
	sqlStore := db.InitTestDB(t)
	secretsService := manager.SetupTestService(t, database.ProvideSecretsStore(sqlStore))

	redactedUser := &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{
		1: {
			accesscontrol.ActionAlertingProvisioningRead: nil,
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
			1: {accesscontrol.ActionAlertingProvisioningRead: nil},
		},
	}

	secretUser := &user.SignedInUser{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {
				accesscontrol.ActionAlertingProvisioningRead:        nil,
				accesscontrol.ActionAlertingProvisioningReadSecrets: nil,
			},
		},
	}

	for _, tc := range []struct {
		name    string
		decrypt bool
		user    *user.SignedInUser
		err     error
	}{
		{
			name:    "service redacts receivers by default",
			decrypt: false,
			user:    readUser,
			err:     nil,
		},
		{
			name:    "service returns error when trying to decrypt without permission",
			decrypt: true,
			user:    readUser,
			err:     ErrPermissionDenied,
		},
		{
			name:    "service returns error if user is nil and decrypt is true",
			decrypt: true,
			user:    nil,
			err:     ErrPermissionDenied,
		},
		{
			name:    "service decrypts receivers with permission",
			decrypt: true,
			user:    secretUser,
			err:     nil,
		},
	} {
		for _, method := range getMethods {
			t.Run(fmt.Sprintf("%s %s", tc.name, method), func(t *testing.T) {
				sut := createReceiverServiceSut(t, secretsService)

				var res definitions.GettableApiReceiver
				var err error
				if method == "single" {
					q := singleQ(1, "slack receiver")
					q.Decrypt = tc.decrypt
					res, err = sut.GetReceiver(context.Background(), q, tc.user)
				} else {
					q := multiQ(1, "slack receiver")
					q.Decrypt = tc.decrypt
					var multiRes []definitions.GettableApiReceiver
					multiRes, err = sut.GetReceivers(context.Background(), q, tc.user)
					if tc.err == nil {
						require.Len(t, multiRes, 1)
						res = multiRes[0]
					}
				}
				require.ErrorIs(t, err, tc.err)

				if tc.err == nil {
					require.Equal(t, "slack receiver", res.Name)
					require.Len(t, res.GrafanaManagedReceivers, 1)
					require.Equal(t, "UID2", res.GrafanaManagedReceivers[0].UID)

					testedSettings, err := simplejson.NewJson([]byte(res.GrafanaManagedReceivers[0].Settings))
					require.NoError(t, err)
					if tc.decrypt {
						require.Equal(t, "secure url", testedSettings.Get("url").MustString())
					} else {
						require.Equal(t, definitions.RedactedValue, testedSettings.Get("url").MustString())
					}
				}
			})
		}
	}
}

func createReceiverServiceSut(t *testing.T, encryptSvc secrets.Service) *ReceiverService {
	cfg := createEncryptedConfig(t, encryptSvc)
	store := fakes.NewFakeAlertmanagerConfigStore(cfg)
	xact := newNopTransactionManager()
	provisioningStore := fakes.NewFakeProvisioningStore()

	return &ReceiverService{
		ac:                acimpl.ProvideAccessControl(featuremgmt.WithFeatures(), zanzana.NewNoopClient()),
		provisioningStore: provisioningStore,
		cfgStore:          store,
		encryptionService: encryptSvc,
		xact:              xact,
		log:               log.NewNopLogger(),
		validator:         validation.ValidateProvenanceRelaxed,
	}
}

func createEncryptedConfig(t *testing.T, secretService secrets.Service) string {
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
