package mutator

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/admission"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
)

func TestKeeperMutator(t *testing.T) {
	mutator := ProvideKeeperMutator()

	t.Run("when keeper is nil, it returns an error", func(t *testing.T) {
		err := mutator.Mutate(nil, admission.Create)
		require.Error(t, err)
		require.Equal(t, "expected Keeper to be non-nil", err.Error())
	})

	t.Run("when operation is Create and name is empty without GenerateName", func(t *testing.T) {
		keeper := &secretv1beta1.Keeper{}

		err := mutator.Mutate(keeper, admission.Create)
		require.NoError(t, err)
		require.NotEmpty(t, keeper.Name)
		require.True(t, strings.HasPrefix(keeper.Name, "kp-"))
	})

	t.Run("when operation is Create and name is already set", func(t *testing.T) {
		keeper := &secretv1beta1.Keeper{
			ObjectMeta: metav1.ObjectMeta{
				Name: "existing-name",
			},
		}
		originalName := keeper.Name

		err := mutator.Mutate(keeper, admission.Create)
		require.NoError(t, err)
		require.Equal(t, originalName, keeper.Name)
	})

	t.Run("when operation is Create and GenerateName is set", func(t *testing.T) {
		keeper := &secretv1beta1.Keeper{
			ObjectMeta: metav1.ObjectMeta{
				GenerateName: "custom-prefix-",
			},
		}

		err := mutator.Mutate(keeper, admission.Create)
		require.NoError(t, err)
		require.NotEmpty(t, keeper.Name)
		require.True(t, strings.HasPrefix(keeper.Name, "custom-prefix-"))
	})

	t.Run("when operation is Create and both name and GenerateName are set", func(t *testing.T) {
		keeper := &secretv1beta1.Keeper{
			ObjectMeta: metav1.ObjectMeta{
				Name:         "existing-name",
				GenerateName: "custom-prefix-",
			},
		}
		originalName := keeper.Name

		err := mutator.Mutate(keeper, admission.Create)
		require.NoError(t, err)
		require.Equal(t, originalName, keeper.Name)
	})
}
