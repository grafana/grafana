package service_test

import (
	"testing"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/testutils"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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

	t.Run("secret can be referenced only when the active keeper is a 3rd party keeper", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)

		ref := "path-to-secret"
		sv := &secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "sv1",
				Namespace: "ns1",
			},
			Spec: secretv1beta1.SecureValueSpec{
				Description: "desc1",
				Ref:         &ref,
				Decrypters:  []string{"decrypter1"},
			},
			Status: secretv1beta1.SecureValueStatus{},
		}

		// Creating a secure value using ref with the system keeper
		createdSv, err := sut.CreateSv(t.Context(), testutils.CreateSvWithSv(sv))
		require.NotNil(t, err)
		require.Nil(t, createdSv)
		require.Contains(t, err.Error(), "tried to create secure value using reference with system keeper, references can only be used with 3rd party keepers")

		// Create a 3rd party keeper
		keeper := &secretv1beta1.Keeper{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "k1",
				Namespace: "ns1",
			},
			Spec: secretv1beta1.KeeperSpec{
				Description: "desc",
				Aws: &secretv1beta1.KeeperAWSConfig{
					Region: "us-east-1",
					AssumeRole: &secretv1beta1.KeeperAWSAssumeRole{
						AssumeRoleArn: "arn",
						ExternalID:    "id",
					},
				},
			},
		}

		// Create a 3rd party keeper
		_, err = sut.KeeperMetadataStorage.Create(t.Context(), keeper, "actor-uid")
		require.NoError(t, err)

		// Set the new keeper as active
		require.NoError(t, sut.KeeperMetadataStorage.SetAsActive(t.Context(), xkube.Namespace(keeper.Namespace), keeper.Name))

		// Create a secure value using a ref
		createdSv, err = sut.CreateSv(t.Context(), testutils.CreateSvWithSv(sv))
		require.NoError(t, err)
		require.Equal(t, keeper.Name, createdSv.Status.Keeper)
	})

	t.Run("creating secure value with reference", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)

		// Create a keeper because references cannot be used with the system keeper
		keeper, err := sut.KeeperMetadataStorage.Create(t.Context(), &secretv1beta1.Keeper{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "ns",
				Name:      "k1",
			},
			Spec: secretv1beta1.KeeperSpec{
				Aws: &secretv1beta1.KeeperAWSConfig{},
			},
		}, "actor-uid")
		require.NoError(t, err)

		require.NoError(t, sut.KeeperMetadataStorage.SetAsActive(t.Context(), xkube.Namespace(keeper.Namespace), keeper.Name))

		sv, err := sut.CreateSv(t.Context())
		require.NoError(t, err)
		require.NotNil(t, sv)
	})
}

func Test_SetAsActive(t *testing.T) {
	t.Parallel()

	t.Run("setting the system keeper as the active keeper", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)

		namespace := "ns"

		// Create a new keeper
		keeper, err := sut.KeeperMetadataStorage.Create(t.Context(), &secretv1beta1.Keeper{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "ns",
				Name:      "k1",
			},
			Spec: secretv1beta1.KeeperSpec{
				Description: "description",
				Aws:         &secretv1beta1.KeeperAWSConfig{},
			},
		}, "actor-uid")
		require.NoError(t, err)

		// Set the new keeper as active
		require.NoError(t, sut.KeeperMetadataStorage.SetAsActive(t.Context(), xkube.Namespace(keeper.Namespace), keeper.Name))
		keeperName, _, err := sut.KeeperMetadataStorage.GetActiveKeeperConfig(t.Context(), namespace)
		require.NoError(t, err)
		require.Equal(t, keeper.Name, keeperName)

		// Set the system keeper as active
		require.NoError(t, sut.KeeperMetadataStorage.SetAsActive(t.Context(), xkube.Namespace(namespace), contracts.SystemKeeperName))
		keeperName, _, err = sut.KeeperMetadataStorage.GetActiveKeeperConfig(t.Context(), namespace)
		require.NoError(t, err)
		require.Equal(t, contracts.SystemKeeperName, keeperName)
	})

	t.Run("each namespace can have one active keeper", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)

		k1, err := sut.CreateKeeper(t.Context(), func(ckc *testutils.CreateKeeperConfig) {
			ckc.Keeper.Namespace = "ns1"
			ckc.Keeper.Name = "k1"
		})
		require.NoError(t, err)
		k2, err := sut.CreateKeeper(t.Context(), func(ckc *testutils.CreateKeeperConfig) {
			ckc.Keeper.Namespace = "ns2"
			ckc.Keeper.Name = "k2"
		})
		require.NoError(t, err)

		require.NoError(t, sut.KeeperMetadataStorage.SetAsActive(t.Context(), xkube.Namespace(k1.Namespace), k1.Name))
		require.NoError(t, sut.KeeperMetadataStorage.SetAsActive(t.Context(), xkube.Namespace(k2.Namespace), k2.Name))

		keeperName, _, err := sut.KeeperMetadataStorage.GetActiveKeeperConfig(t.Context(), k1.Namespace)
		require.NoError(t, err)
		require.Equal(t, k1.Name, keeperName)

		keeperName, _, err = sut.KeeperMetadataStorage.GetActiveKeeperConfig(t.Context(), k2.Namespace)
		require.NoError(t, err)
		require.Equal(t, k2.Name, keeperName)
	})
}
