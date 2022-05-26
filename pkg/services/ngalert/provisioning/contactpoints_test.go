package provisioning

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	"github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
)

func TestContactPointService(t *testing.T) {
	sqlStore := sqlstore.InitTestDB(t)
	secretsService := manager.SetupTestService(t, database.ProvideSecretsStore(sqlStore))
	t.Run("service gets contact points from AM config", func(t *testing.T) {
		sut := createContactPointServiceSut(secretsService)

		cps, err := sut.GetContactPoints(context.Background(), 1)
		require.NoError(t, err)

		require.Len(t, cps, 1)
		require.Equal(t, "email receiver", cps[0].Name)
	})

	t.Run("service stitches contact point into org's AM config", func(t *testing.T) {
		sut := createContactPointServiceSut(secretsService)
		newCp := createTestContactPoint()

		_, err := sut.CreateContactPoint(context.Background(), 1, newCp, models.ProvenanceAPI)
		require.NoError(t, err)

		cps, err := sut.GetContactPoints(context.Background(), 1)
		require.NoError(t, err)
		require.Len(t, cps, 2)
		require.Equal(t, "test-contact-point", cps[1].Name)
		require.Equal(t, "slack", cps[1].Type)
	})

	t.Run("default provenance of contact points is none", func(t *testing.T) {
		sut := createContactPointServiceSut(secretsService)

		cps, err := sut.GetContactPoints(context.Background(), 1)
		require.NoError(t, err)

		require.Equal(t, models.ProvenanceNone, models.Provenance(cps[0].Provenance))
	})

	t.Run("it's possible to update provenance from none to API", func(t *testing.T) {
		sut := createContactPointServiceSut(secretsService)
		newCp := createTestContactPoint()

		newCp, err := sut.CreateContactPoint(context.Background(), 1, newCp, models.ProvenanceNone)
		require.NoError(t, err)

		cps, err := sut.GetContactPoints(context.Background(), 1)
		require.NoError(t, err)
		require.Equal(t, newCp.UID, cps[1].UID)
		require.Equal(t, models.ProvenanceNone, models.Provenance(cps[1].Provenance))

		err = sut.UpdateContactPoint(context.Background(), 1, newCp, models.ProvenanceAPI)
		require.NoError(t, err)

		cps, err = sut.GetContactPoints(context.Background(), 1)
		require.NoError(t, err)
		require.Equal(t, newCp.UID, cps[1].UID)
		require.Equal(t, models.ProvenanceAPI, models.Provenance(cps[1].Provenance))
	})

	t.Run("it's possible to update provenance from none to File", func(t *testing.T) {
		sut := createContactPointServiceSut(secretsService)
		newCp := createTestContactPoint()

		newCp, err := sut.CreateContactPoint(context.Background(), 1, newCp, models.ProvenanceNone)
		require.NoError(t, err)

		cps, err := sut.GetContactPoints(context.Background(), 1)
		require.NoError(t, err)
		require.Equal(t, newCp.UID, cps[1].UID)
		require.Equal(t, models.ProvenanceNone, models.Provenance(cps[1].Provenance))

		err = sut.UpdateContactPoint(context.Background(), 1, newCp, models.ProvenanceFile)
		require.NoError(t, err)

		cps, err = sut.GetContactPoints(context.Background(), 1)
		require.NoError(t, err)
		require.Equal(t, newCp.UID, cps[1].UID)
		require.Equal(t, models.ProvenanceFile, models.Provenance(cps[1].Provenance))
	})

	t.Run("it's not possible to update provenance from File to API", func(t *testing.T) {
		sut := createContactPointServiceSut(secretsService)
		newCp := createTestContactPoint()

		newCp, err := sut.CreateContactPoint(context.Background(), 1, newCp, models.ProvenanceFile)
		require.NoError(t, err)

		cps, err := sut.GetContactPoints(context.Background(), 1)
		require.NoError(t, err)
		require.Equal(t, newCp.UID, cps[1].UID)
		require.Equal(t, models.ProvenanceFile, models.Provenance(cps[1].Provenance))

		err = sut.UpdateContactPoint(context.Background(), 1, newCp, models.ProvenanceAPI)
		require.Error(t, err)
	})

	t.Run("it's not possible to update provenance from API to File", func(t *testing.T) {
		sut := createContactPointServiceSut(secretsService)
		newCp := createTestContactPoint()

		newCp, err := sut.CreateContactPoint(context.Background(), 1, newCp, models.ProvenanceAPI)
		require.NoError(t, err)

		cps, err := sut.GetContactPoints(context.Background(), 1)
		require.NoError(t, err)
		require.Equal(t, newCp.UID, cps[1].UID)
		require.Equal(t, models.ProvenanceAPI, models.Provenance(cps[1].Provenance))

		err = sut.UpdateContactPoint(context.Background(), 1, newCp, models.ProvenanceFile)
		require.Error(t, err)
	})

	t.Run("service respects concurrency token when updating", func(t *testing.T) {
		sut := createContactPointServiceSut(secretsService)
		newCp := createTestContactPoint()
		q := models.GetLatestAlertmanagerConfigurationQuery{
			OrgID: 1,
		}
		err := sut.amStore.GetLatestAlertmanagerConfiguration(context.Background(), &q)
		require.NoError(t, err)
		expectedConcurrencyToken := q.Result.ConfigurationHash

		_, err = sut.CreateContactPoint(context.Background(), 1, newCp, models.ProvenanceAPI)
		require.NoError(t, err)

		fake := sut.amStore.(*fakeAMConfigStore)
		intercepted := fake.lastSaveCommand
		require.Equal(t, expectedConcurrencyToken, intercepted.FetchedConfigurationHash)
	})
}

func TestContactPointInUse(t *testing.T) {
	result := isContactPointInUse("test", []*definitions.Route{
		{
			Receiver: "not-test",
			Routes: []*definitions.Route{
				{
					Receiver: "not-test",
				},
				{
					Receiver: "test",
				},
			},
		},
	})
	require.True(t, result)
	result = isContactPointInUse("test", []*definitions.Route{
		{
			Receiver: "not-test",
			Routes: []*definitions.Route{
				{
					Receiver: "not-test",
				},
				{
					Receiver: "not-test",
				},
			},
		},
	})
	require.False(t, result)
}

func createContactPointServiceSut(secretService secrets.Service) *ContactPointService {
	return &ContactPointService{
		amStore:           newFakeAMConfigStore(),
		provenanceStore:   NewFakeProvisioningStore(),
		xact:              newNopTransactionManager(),
		encryptionService: secretService,
		log:               log.NewNopLogger(),
	}
}

func createTestContactPoint() definitions.EmbeddedContactPoint {
	settings, _ := simplejson.NewJson([]byte(`{"recipient":"value_recipient","token":"value_token"}`))
	return definitions.EmbeddedContactPoint{
		Name:     "test-contact-point",
		Type:     "slack",
		Settings: settings,
	}
}
