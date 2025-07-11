package service_test

import (
	"testing"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/testutils"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/stretchr/testify/require"
	"k8s.io/utils/ptr"
)

func TestCrud(t *testing.T) {
	t.Parallel()

	t.Run("creating a secure value creates new versions", func(t *testing.T) {
		t.Parallel()
		sut := testutils.Setup(t)

		sv1, err := sut.CreateSv(t.Context())
		require.NoError(t, err)

		// Create the same secure value twice
		input := sv1.DeepCopy()
		input.Spec.Description = "d2"
		input.Spec.Value = ptr.To(secretv1beta1.NewExposedSecureValue("v2"))

		sv2, err := sut.CreateSv(t.Context(), testutils.CreateSvWithSv(input))
		require.NoError(t, err)
		require.True(t, sv2.Status.Version > sv1.Status.Version)

		// Read the secure value
		sv, err := sut.SecureValueService.Read(t.Context(), xkube.Namespace(sv2.Namespace), sv2.Name)
		require.NoError(t, err)

		// It should be the latest version
		require.Equal(t, sv2.Namespace, sv.Namespace)
		require.Equal(t, sv2.Name, sv.Name)
		require.Equal(t, "d2", sv.Spec.Description)
		require.Equal(t, sv2.Status.Version, sv.Status.Version)
	})

	t.Run("updating a secure value creates new versions", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)

		// Create a secure value
		sv1, err := sut.CreateSv(t.Context())
		require.NoError(t, err)

		ns := sv1.Namespace
		name := sv1.Name

		// Update the secure value
		input := sv1.DeepCopy()
		input.Spec.Description = "d2"
		input.Spec.Value = ptr.To(secretv1beta1.NewExposedSecureValue("v3"))
		sv2, err := sut.UpdateSv(t.Context(), input)
		require.NoError(t, err)

		// Read the secure value
		sv3, err := sut.SecureValueService.Read(t.Context(), xkube.Namespace(ns), name)
		require.NoError(t, err)

		// Nothing has changed except for the updated field.
		require.Equal(t, ns, sv2.Namespace)
		require.Equal(t, name, sv2.Name)
		require.True(t, sv2.Status.Version > sv1.Status.Version)
		require.Equal(t, "d2", sv2.Spec.Description)

		require.Equal(t, ns, sv3.Namespace)
		require.Equal(t, name, sv3.Name)
		require.Equal(t, sv2.Status.Version, sv3.Status.Version)
		require.Equal(t, "d2", sv3.Spec.Description)
	})

	t.Run("deleting secure values", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)

		sv1, err := sut.CreateSv(t.Context())
		require.NoError(t, err)

		sv2, err := sut.DeleteSv(t.Context(), sv1.Namespace, sv1.Name)
		require.NoError(t, err)

		require.Equal(t, sv1.Namespace, sv2.Namespace)
		require.Equal(t, sv1.Name, sv2.Name)

		_, err = sut.SecureValueMetadataStorage.Read(t.Context(), xkube.Namespace(sv1.Namespace), sv1.Name, contracts.ReadOpts{})
		require.ErrorIs(t, err, contracts.ErrSecureValueNotFound)
	})
}
