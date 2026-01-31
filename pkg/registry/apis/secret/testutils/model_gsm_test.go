package testutils

import (
	"testing"
	"time"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestModelGsm(t *testing.T) {
	t.Parallel()

	t.Run("DeleteKeeper: keeper doesn't exist -> return error", func(t *testing.T) {
		m := NewModelGsm(NewModelSecretsManager())
		require.ErrorIs(t, m.DeleteKeeper("any", "any"), contracts.ErrKeeperNotFound)
	})

	t.Run("DeleteKeeper: keeper being referenced by secure value -> return error", func(t *testing.T) {
		m := NewModelGsm(NewModelSecretsManager())
		k, err := m.CreateKeeper(&secretv1beta1.Keeper{ObjectMeta: metav1.ObjectMeta{Namespace: "n1", Name: "k1"}})
		require.NoError(t, err)
		require.NoError(t, m.SetKeeperAsActive(k.Namespace, k.Name))
		m.Create(time.Now(), &secretv1beta1.SecureValue{ObjectMeta: metav1.ObjectMeta{Namespace: "n1", Name: "sv1"}})
		require.ErrorIs(t, m.DeleteKeeper(k.Namespace, k.Name), contracts.ErrKeeperIsBeingUsedBySecureValue)
	})

	t.Run("DeleteKeeper: keeper that's not being used -> ok", func(t *testing.T) {
		m := NewModelGsm(NewModelSecretsManager())

		// Delete active keeper
		k, err := m.CreateKeeper(&secretv1beta1.Keeper{ObjectMeta: metav1.ObjectMeta{Namespace: "n1", Name: "k1"}})
		require.NoError(t, err)
		require.NoError(t, m.SetKeeperAsActive(k.Namespace, k.Name))
		require.NoError(t, m.DeleteKeeper(k.Namespace, k.Name))

		// Delete inactive keeper
		k, err = m.CreateKeeper(&secretv1beta1.Keeper{ObjectMeta: metav1.ObjectMeta{Namespace: "n1", Name: "k1"}})
		require.NoError(t, err)
		require.NoError(t, m.DeleteKeeper(k.Namespace, k.Name))
	})
}
