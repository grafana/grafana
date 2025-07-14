package sqlkeeper_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/testutils"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func Test_SQLKeeperSetup(t *testing.T) {
	namespace1 := "namespace1"
	name1 := "name1"
	version1 := int64(1)
	namespace2 := "namespace2"
	name2 := "name2"
	plaintext1 := "very secret string in namespace 1"
	plaintext2 := "very secret string in namespace 2"

	keeperCfg := &secretv1beta1.SystemKeeperConfig{}

	t.Run("storing an encrypted value returns no error", func(t *testing.T) {
		sut := testutils.Setup(t)

		_, err := sut.SQLKeeper.Store(t.Context(), keeperCfg, namespace1, name1, version1, plaintext1)
		require.NoError(t, err)

		_, err = sut.SQLKeeper.Store(t.Context(), keeperCfg, namespace2, name2, version1, plaintext2)
		require.NoError(t, err)

		t.Run("expose the encrypted value from existing namespace", func(t *testing.T) {
			sut := testutils.Setup(t)

			_, err := sut.SQLKeeper.Store(t.Context(), keeperCfg, namespace1, name1, version1, plaintext1)
			require.NoError(t, err)

			exposedVal1, err := sut.SQLKeeper.Expose(t.Context(), keeperCfg, namespace1, name1, version1)
			require.NoError(t, err)
			require.NotNil(t, exposedVal1)
			assert.Equal(t, plaintext1, exposedVal1.DangerouslyExposeAndConsumeValue())

			_, err = sut.SQLKeeper.Store(t.Context(), keeperCfg, namespace2, name2, version1, plaintext2)
			require.NoError(t, err)

			exposedVal2, err := sut.SQLKeeper.Expose(t.Context(), keeperCfg, namespace2, name2, version1)
			require.NoError(t, err)
			require.NotNil(t, exposedVal2)
			assert.Equal(t, plaintext2, exposedVal2.DangerouslyExposeAndConsumeValue())
		})

		t.Run("expose encrypted value from different namespace returns error", func(t *testing.T) {
			sut := testutils.Setup(t)

			_, err = sut.SQLKeeper.Store(t.Context(), keeperCfg, namespace1, name1, version1, plaintext1)
			require.NoError(t, err)

			exposedVal, err := sut.SQLKeeper.Expose(t.Context(), keeperCfg, namespace2, name1, version1)
			require.Error(t, err)
			assert.Empty(t, exposedVal)

			exposedVal, err = sut.SQLKeeper.Expose(t.Context(), keeperCfg, namespace1, name2, version1)
			require.Error(t, err)
			assert.Empty(t, exposedVal)
		})
	})

	t.Run("storing same value in same namespace returns error", func(t *testing.T) {
		sut := testutils.Setup(t)

		_, err := sut.SQLKeeper.Store(t.Context(), keeperCfg, namespace1, name1, version1, plaintext1)
		require.NoError(t, err)

		_, err = sut.SQLKeeper.Store(t.Context(), keeperCfg, namespace1, name1, version1, plaintext1)
		require.NotNil(t, err)
	})

	t.Run("storing same value in different namespace returns no error", func(t *testing.T) {
		sut := testutils.Setup(t)

		_, err := sut.SQLKeeper.Store(t.Context(), keeperCfg, namespace1, name1, version1, plaintext1)
		require.NoError(t, err)

		_, err = sut.SQLKeeper.Store(t.Context(), keeperCfg, namespace2, name1, version1, plaintext1)
		require.NoError(t, err)
	})

	t.Run("exposing non existing values returns error", func(t *testing.T) {
		sut := testutils.Setup(t)

		exposedVal, err := sut.SQLKeeper.Expose(t.Context(), keeperCfg, namespace1, "non_existing_name", version1)
		require.Error(t, err)
		assert.Empty(t, exposedVal)
	})

	t.Run("deleting an existing encrypted value does not return error", func(t *testing.T) {
		sut := testutils.Setup(t)

		_, err := sut.SQLKeeper.Store(t.Context(), keeperCfg, namespace1, name1, version1, plaintext1)
		require.NoError(t, err)

		exposedVal, err := sut.SQLKeeper.Expose(t.Context(), keeperCfg, namespace1, name1, version1)
		require.NoError(t, err)
		assert.NotNil(t, exposedVal)
		assert.Equal(t, plaintext1, exposedVal.DangerouslyExposeAndConsumeValue())

		err = sut.SQLKeeper.Delete(t.Context(), keeperCfg, namespace1, name1, version1)
		require.NoError(t, err)
	})

	t.Run("deleting an non existing encrypted value does not return error", func(t *testing.T) {
		sut := testutils.Setup(t)

		err := sut.SQLKeeper.Delete(t.Context(), keeperCfg, namespace1, "non_existing_name", version1)
		require.NoError(t, err)
	})

	t.Run("updating an existent encrypted value returns no error", func(t *testing.T) {
		sut := testutils.Setup(t)

		_, err := sut.SQLKeeper.Store(t.Context(), keeperCfg, namespace1, name1, version1, plaintext1)
		require.NoError(t, err)

		err = sut.SQLKeeper.Update(t.Context(), keeperCfg, namespace1, name1, version1, plaintext2)
		require.NoError(t, err)

		exposedVal, err := sut.SQLKeeper.Expose(t.Context(), keeperCfg, namespace1, name1, version1)
		require.NoError(t, err)
		assert.NotNil(t, exposedVal)
		assert.Equal(t, plaintext2, exposedVal.DangerouslyExposeAndConsumeValue())
	})

	t.Run("updating a non existent encrypted value returns error", func(t *testing.T) {
		sut := testutils.Setup(t)

		_, err := sut.SQLKeeper.Store(t.Context(), keeperCfg, namespace1, name1, version1, plaintext1)
		require.NoError(t, err)

		err = sut.SQLKeeper.Update(t.Context(), nil, namespace1, "non_existing_name", version1, plaintext2)
		require.Error(t, err)
	})
}
