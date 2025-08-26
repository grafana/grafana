package garbagecollectionworker_test

import (
	"fmt"
	"slices"
	"testing"
	"time"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/testutils"
	"github.com/grafana/grafana/pkg/storage/secret/encryption"
	"github.com/mitchellh/copystructure"
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

	t.Run("inactive secure values are not deleted immediatelly because of the grace period", func(t *testing.T) {
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

		keeperCfg, err := sut.KeeperMetadataStorage.GetKeeperConfig(t.Context(), sv.Namespace, sv.Spec.Keeper, contracts.ReadOpts{ForUpdate: false})
		require.NoError(t, err)

		keeper, err := sut.KeeperService.KeeperForConfig(keeperCfg)
		require.NoError(t, err)

		// Get the secret value once to make sure it's reachable
		exposedValue, err := keeper.Expose(t.Context(), keeperCfg, sv.Namespace, sv.Name, sv.Status.Version)
		require.NoError(t, err)
		require.NotEmpty(t, exposedValue.DangerouslyExposeAndConsumeValue())

		_, err = sut.DeleteSv(t.Context(), sv.Namespace, sv.Name)
		require.NoError(t, err)

		// Advance time to wait for grace period
		sut.Clock.AdvanceBy(10 * time.Minute)

		ids, err := sut.GarbageCollectionWorker.CleanupInactiveSecureValues(t.Context())
		require.NoError(t, err)
		require.Equal(t, 1, len(ids))
		require.Equal(t, sv.UID, ids[0])

		ids, err = sut.GarbageCollectionWorker.CleanupInactiveSecureValues(t.Context())
		require.NoError(t, err)
		require.Empty(t, ids)

		// Try to get the secreet value again to make sure it's been deleted from the keeper
		exposedValue, err = keeper.Expose(t.Context(), keeperCfg, sv.Namespace, sv.Name, sv.Status.Version)
		require.ErrorIs(t, err, encryption.ErrEncryptedValueNotFound)
		require.Empty(t, exposedValue)
	})
}

var (
	decryptersGen     = rapid.SampledFrom([]string{"svc1", "svc2", "svc3", "svc4", "svc5"})
	nameGen           = rapid.SampledFrom([]string{"n1", "n2", "n3", "n4", "n5"})
	namespaceGen      = rapid.SampledFrom([]string{"ns1", "ns2", "ns3", "ns4", "ns5"})
	anySecureValueGen = rapid.Custom(func(t *rapid.T) *secretv1beta1.SecureValue {
		return &secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Name:      nameGen.Draw(t, "name"),
				Namespace: namespaceGen.Draw(t, "ns"),
			},
			Spec: secretv1beta1.SecureValueSpec{
				Description: rapid.SampledFrom([]string{"d1", "d2", "d3", "d4", "d5"}).Draw(t, "description"),
				Value:       ptr.To(secretv1beta1.NewExposedSecureValue(rapid.SampledFrom([]string{"v1", "v2", "v3", "v4", "v5"}).Draw(t, "value"))),
				Decrypters:  rapid.SliceOfDistinct(decryptersGen, func(v string) string { return v }).Draw(t, "decrypters"),
			},
			Status: secretv1beta1.SecureValueStatus{},
		}
	})
)

func TestProperty(t *testing.T) {
	t.Parallel()

	tt := t

	rapid.Check(t, func(t *rapid.T) {
		sut := testutils.Setup(tt)
		model := newModel()

		t.Repeat(map[string]func(*rapid.T){
			"create": func(t *rapid.T) {
				sv := anySecureValueGen.Draw(t, "sv")
				svCopy := deepCopy(sv)

				createdSv, err := sut.CreateSv(t.Context(), testutils.CreateSvWithSv(sv))
				require.NoError(t, err)
				svCopy.UID = createdSv.UID
				model.create(sut.Clock.Now(), svCopy)
			},
			"delete": func(t *rapid.T) {
				if len(model.items) == 0 {
					return
				}

				i := rapid.IntRange(0, len(model.items)-1).Draw(t, "index")
				sv := model.items[i]
				modelErr := model.delete(sv.Namespace, sv.Name)
				_, err := sut.DeleteSv(t.Context(), sv.Namespace, sv.Name)
				require.ErrorIs(t, err, modelErr)
			},
			"cleanup": func(t *rapid.T) {
				// Taken from secureValueMetadataStorage.acquireLeases
				minAge := 300 * time.Second
				maxBatchSize := sut.GarbageCollectionWorker.Cfg.MaxBatchSize
				modelDeleted, modelErr := model.cleanupInactiveSecureValues(sut.Clock.Now(), minAge, maxBatchSize)
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

type model struct {
	items []*modelSecureValue
}

type modelSecureValue struct {
	*secretv1beta1.SecureValue
	active  bool
	created time.Time
}

func newModel() *model {
	return &model{
		items: make([]*modelSecureValue, 0),
	}
}

func (m *model) create(now time.Time, sv *secretv1beta1.SecureValue) {
	// Creating a new version of a secure value that already exists inactivates older versions
	for _, item := range m.items {
		if item.active && item.Namespace == sv.Namespace && item.Name == sv.Name {
			item.active = false
			break
		}
	}
	m.items = append(m.items, &modelSecureValue{SecureValue: sv, active: true, created: now})
}

func (m *model) delete(ns string, name string) error {
	for _, sv := range m.items {
		if sv.active && sv.Namespace == ns && sv.Name == name {
			sv.active = false
			return nil
		}
	}

	return contracts.ErrSecureValueNotFound
}

func (m *model) cleanupInactiveSecureValues(now time.Time, minAge time.Duration, maxBatchSize uint16) ([]*modelSecureValue, error) {
	// Using a slice to allow duplicates
	toDelete := make([]*modelSecureValue, 0)

	for _, sv := range m.items {
		if len(toDelete) >= int(maxBatchSize) {
			break
		}

		if !sv.active && now.Sub(sv.created) > minAge {
			toDelete = append(toDelete, sv)
		}
	}

	// PERF: The slices are always small
	m.items = slices.DeleteFunc(m.items, func(v1 *modelSecureValue) bool {
		return slices.ContainsFunc(toDelete, func(v2 *modelSecureValue) bool {
			return v2.UID == v1.UID
		})
	})

	return toDelete, nil
}

func deepCopy[T any](sv T) T {
	copied, err := copystructure.Copy(sv)
	if err != nil {
		panic(fmt.Sprintf("failed to copy secure value: %v", err))
	}
	return copied.(T)
}
