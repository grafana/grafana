package metadata

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSecureValue_DecryptersFor(t *testing.T) {
	t.Parallel()

	t.Run("return decrypters for N secure values", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		cfg := setting.NewCfg()

		featureFlags := featuremgmt.WithFeatures(
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
			featuremgmt.FlagSecretsManagementAppPlatform,
		)

		db := sqlstore.NewTestStore(t)

		keeperService := &fakeKeeperService{}

		metadataStorage, err := ProvideSecureValueMetadataStorage(db, cfg, featureFlags, nil, keeperService)
		require.NoError(t, err)

		ns := "namespace"
		sv1, sv2, sv3 := "name1", "name2", "name3"

		createSecureValueInDB(t, db, ns, sv1, []string{"decrypter1", "decrypter2"})
		createSecureValueInDB(t, db, ns, sv2, []string{"decrypter1", "decrypter3", "decrypter4"})
		createSecureValueInDB(t, db, ns, sv3, nil)

		decrypters, err := metadataStorage.DecryptersFor(ctx, xkube.Namespace(ns), []string{sv1, sv2, sv3})
		require.NoError(t, err)
		require.Equal(t, 3, len(decrypters))
		require.ElementsMatch(t, []string{"decrypter1", "decrypter2"}, decrypters[sv1])
		require.ElementsMatch(t, []string{"decrypter1", "decrypter3", "decrypter4"}, decrypters[sv2])
		require.Nil(t, decrypters[sv3])
	})

	t.Run("return error if any of the requested secure values does not exist", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		cfg := setting.NewCfg()

		featureFlags := featuremgmt.WithFeatures(
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
			featuremgmt.FlagSecretsManagementAppPlatform,
		)

		db := sqlstore.NewTestStore(t)

		keeperService := &fakeKeeperService{}

		metadataStorage, err := ProvideSecureValueMetadataStorage(db, cfg, featureFlags, nil, keeperService)
		require.NoError(t, err)

		ns := "namespace"
		sv1, sv2 := "name1", "name2"

		// name2 does not exist
		createSecureValueInDB(t, db, ns, sv1, []string{"decrypter1", "decrypter2"})

		decrypters, err := metadataStorage.DecryptersFor(ctx, xkube.Namespace(ns), []string{sv1, sv2})
		require.ErrorIs(t, err, contracts.ErrSecureValueNotFound)
		require.Nil(t, decrypters)
	})
}

func createSecureValueInDB(t *testing.T, db *sqlstore.SQLStore, namespace, name string, decrypters []string) {
	t.Helper()

	var listDecrypters *string
	if len(decrypters) > 0 {
		decryptersJSON, err := json.Marshal(decrypters)
		require.NoError(t, err)

		decryptersStr := string(decryptersJSON)
		listDecrypters = &decryptersStr
	}

	err := db.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		now := time.Now().Unix()

		_, err := sess.Insert(&secureValueDB{
			GUID:       uuid.New().String(),
			Name:       name,
			Namespace:  namespace,
			Created:    now,
			CreatedBy:  "author",
			Updated:    now,
			UpdatedBy:  "author",
			Phase:      string(secretv0alpha1.SecureValuePhaseSucceeded),
			Title:      "title",
			Keeper:     "default",
			Decrypters: listDecrypters,
			ExternalID: "external-id",
		})

		return err
	})
	require.NoError(t, err)

	t.Cleanup(func() {
		deleteSecureValueFromDB(t, db, namespace, name)
	})
}

func deleteSecureValueFromDB(t *testing.T, db *sqlstore.SQLStore, namespace, name string) {
	t.Helper()

	err := db.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err := sess.Delete(&secureValueDB{Name: name, Namespace: namespace})
		return err
	})
	require.NoError(t, err)
}

type fakeKeeperService struct {
	keepers map[contracts.KeeperType]contracts.Keeper
}

func (m *fakeKeeperService) GetKeepers() (map[contracts.KeeperType]contracts.Keeper, error) {
	return m.keepers, nil
}
