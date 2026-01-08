package garbagecollectionworker_test

import (
	"testing"
	"time"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/testutils"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/storage/secret/encryption"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/utils/ptr"
	"pgregory.net/rapid"
)

func TestBasic(t *testing.T) {
	t.Parallel()

	t.Run("when no secure values exist, there's no work to do", func(t *testing.T) {
		t.Parallel()
		sut := testutils.Setup(t)
		ids, err := sut.GarbageCollectionWorker.CleanupInactiveSecureValues(t.Context())
		require.NoError(t, err)
		require.Empty(t, ids)
	})

	t.Run("inactive secure values are not deleted immediately because of the grace period", func(t *testing.T) {
		t.Parallel()
		sut := testutils.Setup(t)

		sv1, err := sut.CreateSv(t.Context())
		require.NoError(t, err)

		_, err = sut.DeleteSv(t.Context(), sv1.Namespace, sv1.Name)
		require.NoError(t, err)

		// Try to fetch inactive secure values for deletion
		svs, err := sut.SecureValueMetadataStorage.LeaseInactiveSecureValues(t.Context(), 10)
		require.NoError(t, err)
		require.Empty(t, svs)
	})

	t.Run("secure values are fetched for deletion and deleted from keeper", func(t *testing.T) {
		sut := testutils.Setup(t)

		sv, err := sut.CreateSv(t.Context())
		require.NoError(t, err)

		keeperCfg, err := sut.KeeperMetadataStorage.GetKeeperConfig(t.Context(), sv.Namespace, sv.Status.Keeper, contracts.ReadOpts{ForUpdate: false})
		require.NoError(t, err)

		keeper, err := sut.KeeperService.KeeperForConfig(keeperCfg)
		require.NoError(t, err)

		// Get the secret value once to make sure it's reachable
		exposedValue, err := keeper.Expose(t.Context(), keeperCfg, xkube.Namespace(sv.Namespace), sv.Name, sv.Status.Version)
		require.NoError(t, err)
		require.NotEmpty(t, exposedValue.DangerouslyExposeAndConsumeValue())

		_, err = sut.DeleteSv(t.Context(), sv.Namespace, sv.Name)
		require.NoError(t, err)

		// Advance time to wait for grace period
		sut.Clock.AdvanceBy(10 * time.Minute)

		svs, err := sut.GarbageCollectionWorker.CleanupInactiveSecureValues(t.Context())
		require.NoError(t, err)
		require.Equal(t, 1, len(svs))
		require.Equal(t, sv.UID, svs[0].UID)

		svs, err = sut.GarbageCollectionWorker.CleanupInactiveSecureValues(t.Context())
		require.NoError(t, err)
		require.Empty(t, svs)

		// Try to get the secreet value again to make sure it's been deleted from the keeper
		exposedValue, err = keeper.Expose(t.Context(), keeperCfg, xkube.Namespace(sv.Namespace), sv.Name, sv.Status.Version)
		require.ErrorIs(t, err, encryption.ErrEncryptedValueNotFound)
		require.Empty(t, exposedValue)
	})

	t.Run("cleaning up secure values is idempotent", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)

		sv, err := sut.CreateSv(t.Context())
		require.NoError(t, err)

		_, err = sut.DeleteSv(t.Context(), sv.Namespace, sv.Name)
		require.NoError(t, err)

		// Clean up the same secure value twice and ensure it succeeds
		require.NoError(t, sut.GarbageCollectionWorker.Cleanup(t.Context(), sv))
		require.NoError(t, sut.GarbageCollectionWorker.Cleanup(t.Context(), sv))
	})

	t.Run("cleaning up secure values that use references", func(t *testing.T) {
		sut := testutils.Setup(t)

		keeper, err := sut.CreateAWSKeeper(t.Context())
		require.NoError(t, err)

		require.NoError(t, sut.KeeperMetadataStorage.SetAsActive(t.Context(), xkube.Namespace(keeper.Namespace), keeper.Name))

		sv, err := sut.CreateSv(t.Context(), testutils.CreateSvWithSv(&secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: keeper.Namespace,
				Name:      "sv1",
			},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "desc1",
				Ref:         ptr.To("ref1"),
				Decrypters:  []string{"decrypter1"},
			},
		}))
		require.NoError(t, err)

		_, err = sut.DeleteSv(t.Context(), sv.Namespace, sv.Name)
		require.NoError(t, err)
		require.NoError(t, sut.GarbageCollectionWorker.Cleanup(t.Context(), sv))
	})
}

func TestProperty(t *testing.T) {
	t.Parallel()

	tt := t

	rapid.Check(t, func(t *rapid.T) {
		sut := testutils.Setup(tt)
		model := testutils.NewModelGsm(nil)

		t.Repeat(map[string]func(*rapid.T){
			"create": func(t *rapid.T) {
				var sv *secretv1beta1.SecureValue
				if rapid.Bool().Draw(t, "withRef") {
					sv = testutils.AnySecureValueWithRefGen.Draw(t, "sv")
				} else {
					sv = testutils.AnySecureValueGen.Draw(t, "sv")
				}

				svCopy := sv.DeepCopy()

				createdSv, err := sut.CreateSv(t.Context(), testutils.CreateSvWithSv(sv))
				if err == nil {
					svCopy.UID = createdSv.UID
				}
				_, modelErr := model.Create(sut.Clock.Now(), svCopy)
				require.ErrorIs(t, err, modelErr)
			},
			"createKeeper": func(t *rapid.T) {
				input := testutils.AnyKeeperGen.Draw(t, "keeper")
				modelKeeper, modelErr := model.CreateKeeper(input)
				keeper, err := sut.KeeperMetadataStorage.Create(t.Context(), input, "actor-uid")
				if err != nil || modelErr != nil {
					require.ErrorIs(t, err, modelErr)
					return
				}
				require.Equal(t, modelKeeper.Name, keeper.Name)
			},
			"setKeeperAsActive": func(t *rapid.T) {
				namespace := testutils.NamespaceGen.Draw(t, "namespace")
				var keeper string
				if rapid.Bool().Draw(t, "systemKeeper") {
					keeper = contracts.SystemKeeperName
				} else {
					keeper = testutils.KeeperNameGen.Draw(t, "keeper")
				}
				modelErr := model.SetKeeperAsActive(namespace, keeper)
				err := sut.KeeperMetadataStorage.SetAsActive(t.Context(), xkube.Namespace(namespace), keeper)
				if err != nil || modelErr != nil {
					require.ErrorIs(t, err, modelErr)
					return
				}
			},
			"delete": func(t *rapid.T) {
				if len(model.SecureValues) == 0 {
					return
				}

				i := rapid.IntRange(0, len(model.SecureValues)-1).Draw(t, "index")
				sv := model.SecureValues[i]
				_, modelErr := model.Delete(sv.Namespace, sv.Name)
				_, err := sut.DeleteSv(t.Context(), sv.Namespace, sv.Name)
				require.ErrorIs(t, err, modelErr)
			},
			"cleanup": func(t *rapid.T) {
				// Taken from secureValueMetadataStorage.acquireLeases
				minAge := 300 * time.Second
				maxBatchSize := sut.GarbageCollectionWorker.Cfg.SecretsManagement.GCWorkerMaxBatchSize
				modelDeleted, modelErr := model.CleanupInactiveSecureValues(sut.Clock.Now(), minAge, maxBatchSize)
				deleted, err := sut.GarbageCollectionWorker.CleanupInactiveSecureValues(t.Context())
				require.ErrorIs(t, err, modelErr)

				require.Equal(t, len(modelDeleted), len(deleted), "model and impl deleted a different number of secure values")
				seen := make(map[types.UID]bool, 0)
				for _, v := range modelDeleted {
					seen[v.UID] = true
				}

				for _, v := range deleted {
					require.True(t, seen[v.UID], "impl deleted a secure value that the model did not")
				}
			},
			"advanceTime": func(t *rapid.T) {
				duration := time.Duration(rapid.IntRange(1, 10).Draw(t, "minutes")) * time.Minute
				sut.Clock.AdvanceBy(duration)
			},
		})
	})
}
