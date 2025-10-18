package mutator

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/admission"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
)

func TestSecureValueMutator(t *testing.T) {
	mutator := ProvideSecureValueMutator()

	populatedStatus := secretv1beta1.SecureValueStatus{
		ExternalID: "existing-external-id",
		Version:    1,
	}

	t.Run("when secure value is nil, it returns an error", func(t *testing.T) {
		err := mutator.Mutate(nil, admission.Create)
		require.Error(t, err)
		require.Equal(t, "expected SecureValue to be non-nil", err.Error())
	})

	t.Run("when operation is Create and name is empty", func(t *testing.T) {
		secureValue := &secretv1beta1.SecureValue{
			Status: populatedStatus,
		}

		err := mutator.Mutate(secureValue, admission.Create)
		require.NoError(t, err)
		require.NotEmpty(t, secureValue.Name)
		require.True(t, strings.HasPrefix(secureValue.Name, "sv-"))
		require.Empty(t, secureValue.Status.ExternalID)
		require.Equal(t, int64(0), secureValue.Status.Version)
	})

	t.Run("when operation is Create and name is already set", func(t *testing.T) {
		secureValue := &secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Name: "existing-name",
			},
			Status: populatedStatus,
		}
		originalName := secureValue.Name

		err := mutator.Mutate(secureValue, admission.Create)
		require.NoError(t, err)
		require.Equal(t, originalName, secureValue.Name)
		require.Empty(t, secureValue.Status.ExternalID)
		require.Equal(t, int64(0), secureValue.Status.Version)
	})

	t.Run("when operation is Create and GenerateName is set", func(t *testing.T) {
		secureValue := &secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				GenerateName: "custom-prefix-",
			},
			Status: populatedStatus,
		}

		err := mutator.Mutate(secureValue, admission.Create)
		require.NoError(t, err)
		require.NotEmpty(t, secureValue.Name)
		require.True(t, strings.HasPrefix(secureValue.Name, "custom-prefix-"))
		require.Empty(t, secureValue.Status.ExternalID)
		require.Equal(t, int64(0), secureValue.Status.Version)
	})

	t.Run("when operation is Create and both name and GenerateName are set", func(t *testing.T) {
		secureValue := &secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Name:         "existing-name",
				GenerateName: "custom-prefix-",
			},
			Status: populatedStatus,
		}
		originalName := secureValue.Name

		err := mutator.Mutate(secureValue, admission.Create)
		require.NoError(t, err)
		require.Equal(t, originalName, secureValue.Name)
		require.Empty(t, secureValue.Status.ExternalID)
		require.Equal(t, int64(0), secureValue.Status.Version)
	})

	t.Run("when operation is Update", func(t *testing.T) {
		secureValue := &secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Name: "existing-name",
			},
			Status: populatedStatus,
		}
		originalName := secureValue.Name

		err := mutator.Mutate(secureValue, admission.Update)
		require.NoError(t, err)
		require.Equal(t, originalName, secureValue.Name)
		require.Empty(t, secureValue.Status.ExternalID)
		require.Equal(t, int64(0), secureValue.Status.Version)
	})

	t.Run("when operation is Update and name is empty", func(t *testing.T) {
		secureValue := &secretv1beta1.SecureValue{
			Status: populatedStatus,
		}

		err := mutator.Mutate(secureValue, admission.Update)
		require.NoError(t, err)
		require.Empty(t, secureValue.Name)
		require.Empty(t, secureValue.Status.ExternalID)
		require.Equal(t, int64(0), secureValue.Status.Version)
	})

	t.Run("when operation is Delete", func(t *testing.T) {
		secureValue := &secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Name: "existing-name",
			},
			Status: populatedStatus,
		}
		originalName := secureValue.Name
		originalExternalID := secureValue.Status.ExternalID
		originalVersion := secureValue.Status.Version

		err := mutator.Mutate(secureValue, admission.Delete)
		require.NoError(t, err)
		require.Equal(t, originalName, secureValue.Name)
		require.Equal(t, originalExternalID, secureValue.Status.ExternalID)
		require.Equal(t, originalVersion, secureValue.Status.Version)
	})

	t.Run("when operation is Connect", func(t *testing.T) {
		secureValue := &secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Name: "existing-name",
			},
			Status: populatedStatus,
		}
		originalName := secureValue.Name
		originalExternalID := secureValue.Status.ExternalID
		originalVersion := secureValue.Status.Version

		err := mutator.Mutate(secureValue, admission.Connect)
		require.NoError(t, err)
		require.Equal(t, originalName, secureValue.Name)
		require.Equal(t, originalExternalID, secureValue.Status.ExternalID)
		require.Equal(t, originalVersion, secureValue.Status.Version)
	})

	t.Run("when operation is Create with empty status", func(t *testing.T) {
		secureValue := &secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Name: "existing-name",
			},
		}

		err := mutator.Mutate(secureValue, admission.Create)
		require.NoError(t, err)
		require.Empty(t, secureValue.Status.ExternalID)
		require.Equal(t, int64(0), secureValue.Status.Version)
	})

	t.Run("when operation is Update with empty status", func(t *testing.T) {
		secureValue := &secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Name: "existing-name",
			},
		}

		err := mutator.Mutate(secureValue, admission.Update)
		require.NoError(t, err)
		require.Empty(t, secureValue.Status.ExternalID)
		require.Equal(t, int64(0), secureValue.Status.Version)
	})
}
