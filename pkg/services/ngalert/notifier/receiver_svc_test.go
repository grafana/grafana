package notifier

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	"github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestReceiverService_GetReceivers(t *testing.T) {
	sqlStore := db.InitTestDB(t)
	secretsService := manager.SetupTestService(t, database.ProvideSecretsStore(sqlStore))

	t.Run("service gets receiver groups from AM config", func(t *testing.T) {
		sut := createReceiverServiceSut(t, secretsService)

		Receivers, err := sut.GetReceivers(context.Background(), rQuery(1), nil)
		require.NoError(t, err)
		require.Len(t, Receivers, 2)
		require.Equal(t, "grafana-default-email", Receivers[0].Name)
		require.Equal(t, "slack receiver", Receivers[1].Name)
	})

	t.Run("service filters receiver groups by name", func(t *testing.T) {
		sut := createReceiverServiceSut(t, secretsService)

		Receivers, err := sut.GetReceivers(context.Background(), rQuery(1, "slack receiver"), nil)
		require.NoError(t, err)
		require.Len(t, Receivers, 1)
		require.Equal(t, "slack receiver", Receivers[0].Name)
	})
}

func TestReceiverService_DecryptRedact(t *testing.T) {
	sqlStore := db.InitTestDB(t)
	secretsService := manager.SetupTestService(t, database.ProvideSecretsStore(sqlStore))
	ac := acimpl.ProvideAccessControl(setting.NewCfg())

	t.Run("service redacts receiver groups by default", func(t *testing.T) {
		sut := createReceiverServiceSut(t, secretsService)
		Receivers, err := sut.GetReceivers(context.Background(), rQuery(1, "slack receiver"), nil)
		require.NoError(t, err)

		require.Len(t, Receivers, 1)

		rGroup := Receivers[0]
		require.Equal(t, "slack receiver", rGroup.Name)
		require.Len(t, rGroup.GrafanaManagedReceivers, 1)

		grafanaReceiver := rGroup.GrafanaManagedReceivers[0]
		require.Equal(t, "UID2", grafanaReceiver.UID)

		testedSettings, err := simplejson.NewJson([]byte(grafanaReceiver.Settings))
		require.NoError(t, err)
		require.Equal(t, definitions.RedactedValue, testedSettings.Get("url").MustString())
	})

	t.Run("service returns error when trying to decrypt with nil user", func(t *testing.T) {
		sut := createReceiverServiceSut(t, secretsService)
		sut.ac = ac

		q := rQuery(1)
		q.Decrypt = true
		_, err := sut.GetReceivers(context.Background(), q, nil)
		require.ErrorIs(t, err, ErrPermissionDenied)
	})

	t.Run("service returns error when trying to decrypt without permission", func(t *testing.T) {
		sut := createReceiverServiceSut(t, secretsService)
		sut.ac = ac

		q := rQuery(1)
		q.Decrypt = true
		_, err := sut.GetReceivers(context.Background(), q, &user.SignedInUser{})
		require.ErrorIs(t, err, ErrPermissionDenied)
	})

	t.Run("service decrypts receiver groups with permission", func(t *testing.T) {
		sut := createReceiverServiceSut(t, secretsService)
		sut.ac = ac

		q := rQuery(1, "slack receiver")
		q.Decrypt = true
		Receivers, err := sut.GetReceivers(context.Background(), q, &user.SignedInUser{
			OrgID: 1,
			Permissions: map[int64]map[string][]string{
				1: {accesscontrol.ActionAlertingProvisioningReadSecrets: nil},
			},
		})
		require.NoError(t, err)

		require.Len(t, Receivers, 1)

		rGroup := Receivers[0]
		require.Equal(t, "slack receiver", rGroup.Name)
		require.Len(t, rGroup.GrafanaManagedReceivers, 1)

		grafanaReceiver := rGroup.GrafanaManagedReceivers[0]
		require.Equal(t, "UID2", grafanaReceiver.UID)

		settings, err := simplejson.NewJson([]byte(grafanaReceiver.Settings))
		require.NoError(t, err)
		require.Equal(t, "secure url", settings.Get("url").MustString())
	})
}

func createReceiverServiceSut(t *testing.T, encryptSvc secrets.Service) *ReceiverService {
	cfg := createEncryptedConfig(t, encryptSvc)
	store := fakes.NewFakeAlertmanagerConfigStore(cfg)
	xact := newNopTransactionManager()
	provisioningStore := fakes.NewFakeProvisioningStore()

	return &ReceiverService{
		actest.FakeAccessControl{},
		provisioningStore,
		store,
		encryptSvc,
		xact,
		log.NewNopLogger(),
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

func rQuery(orgID int64, names ...string) models.GetReceiversQuery {
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
