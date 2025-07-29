package metadata_test

import (
	"context"
	"testing"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/utils/ptr"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/testutils"
)

func TestIntegrationDecrypt(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	t.Parallel()

	t.Run("when no auth info is present, it returns an error", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		sut := testutils.Setup(t)

		exposed, err := sut.DecryptStorage.Decrypt(ctx, "default", "name")
		require.Error(t, err)
		require.Empty(t, exposed)
	})

	t.Run("when secure value cannot be found, it returns an error", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		// Create auth context with proper permissions
		authCtx := createAuthContext(ctx, "default", []string{"secret.grafana.app/securevalues/group1:decrypt"}, "svc", types.TypeUser)

		sut := testutils.Setup(t)

		exposed, err := sut.DecryptStorage.Decrypt(authCtx, "default", "non-existent-value")
		require.ErrorIs(t, err, contracts.ErrDecryptNotFound)
		require.Empty(t, exposed)
	})

	t.Run("when happy path with valid auth and permissions, it returns decrypted value", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		svcIdentity := "svc"

		// Create auth context with proper permissions that match the decrypters
		authCtx := createAuthContext(ctx, "default", []string{"secret.grafana.app/securevalues:decrypt"}, svcIdentity, types.TypeUser)

		// Setup service
		sut := testutils.Setup(t)

		// Create a secure value
		spec := secretv1beta1.SecureValueSpec{
			Description: "description",
			Decrypters:  []string{svcIdentity},
			Value:       ptr.To(secretv1beta1.NewExposedSecureValue("value")),
		}
		sv := &secretv1beta1.SecureValue{Spec: spec}
		sv.Name = "sv-test"
		sv.Namespace = "default"

		_, err := sut.CreateSv(authCtx, testutils.CreateSvWithSv(sv))
		require.NoError(t, err)

		exposed, err := sut.DecryptStorage.Decrypt(authCtx, "default", "sv-test")
		require.NoError(t, err)
		require.NotEmpty(t, exposed)
		require.Equal(t, "value", exposed.DangerouslyExposeAndConsumeValue())
	})

	t.Run("with permissions for a specific secure value but trying to decrypt another one, it returns unauthorized error", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		svName := "sv-test"
		svcIdentity := "svc"

		// Create auth context with proper permissions that match the decrypters
		authCtx := createAuthContext(ctx, "default", []string{"secret.grafana.app/securevalues/sv-test2:decrypt"}, svcIdentity, types.TypeUser)

		// Setup service
		sut := testutils.Setup(t)

		// Create a secure value
		spec := secretv1beta1.SecureValueSpec{
			Description: "description",
			Decrypters:  []string{svcIdentity},
			Value:       ptr.To(secretv1beta1.NewExposedSecureValue("value")),
		}
		sv := &secretv1beta1.SecureValue{Spec: spec}
		sv.Name = svName
		sv.Namespace = "default"

		_, err := sut.CreateSv(authCtx, testutils.CreateSvWithSv(sv))
		require.NoError(t, err)

		exposed, err := sut.DecryptStorage.Decrypt(authCtx, "default", svName)
		require.ErrorIs(t, err, contracts.ErrDecryptNotAuthorized)
		require.Empty(t, exposed)
	})

	t.Run("when permission format is malformed (no verb), it returns unauthorized error", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		svcIdentity := "svc"

		// Create auth context with malformed permission (no verb)
		authCtx := createAuthContext(ctx, "default", []string{"secret.grafana.app/securevalues"}, svcIdentity, types.TypeUser)

		// Setup service
		sut := testutils.Setup(t)

		// Create a secure value
		spec := secretv1beta1.SecureValueSpec{
			Description: "description",
			Decrypters:  []string{svcIdentity},
			Value:       ptr.To(secretv1beta1.NewExposedSecureValue("value")),
		}
		sv := &secretv1beta1.SecureValue{Spec: spec}
		sv.Name = "sv-test"
		sv.Namespace = "default"

		_, err := sut.CreateSv(authCtx, testutils.CreateSvWithSv(sv))
		require.NoError(t, err)

		exposed, err := sut.DecryptStorage.Decrypt(authCtx, "default", "sv-test")
		require.ErrorIs(t, err, contracts.ErrDecryptNotAuthorized)
		require.Empty(t, exposed)
	})

	t.Run("when permission verb is not 'decrypt', it returns unauthorized error", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		svName := "sv-test"
		svcIdentity := "svc"

		// Create auth context with wrong verb
		authCtx := createAuthContext(ctx, "default", []string{"secret.grafana.app/securevalues/" + svName + ":read"}, svcIdentity, types.TypeUser)

		// Setup service
		sut := testutils.Setup(t)

		// Create a secure value
		spec := secretv1beta1.SecureValueSpec{
			Description: "description",
			Decrypters:  []string{svcIdentity},
			Value:       ptr.To(secretv1beta1.NewExposedSecureValue("value")),
		}
		sv := &secretv1beta1.SecureValue{Spec: spec}
		sv.Name = svName
		sv.Namespace = "default"

		_, err := sut.CreateSv(authCtx, testutils.CreateSvWithSv(sv))
		require.NoError(t, err)

		exposed, err := sut.DecryptStorage.Decrypt(authCtx, "default", svName)
		require.ErrorIs(t, err, contracts.ErrDecryptNotAuthorized)
		require.Empty(t, exposed)
	})

	t.Run("when permission has incorrect number of parts, it returns unauthorized error", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		svcIdentity := "svc"

		// Create auth context with incorrect number of parts
		authCtx := createAuthContext(ctx, "default", []string{"secret.grafana.app/securevalues/:decrypt"}, svcIdentity, types.TypeUser)

		// Setup service
		sut := testutils.Setup(t)

		// Create a secure value
		spec := secretv1beta1.SecureValueSpec{
			Description: "description",
			Decrypters:  []string{svcIdentity},
			Value:       ptr.To(secretv1beta1.NewExposedSecureValue("value")),
		}
		sv := &secretv1beta1.SecureValue{Spec: spec}
		sv.Name = "sv-test"
		sv.Namespace = "default"

		_, err := sut.CreateSv(authCtx, testutils.CreateSvWithSv(sv))
		require.NoError(t, err)

		exposed, err := sut.DecryptStorage.Decrypt(authCtx, "default", "sv-test")
		require.ErrorIs(t, err, contracts.ErrDecryptNotAuthorized)
		require.Empty(t, exposed)
	})

	t.Run("when permission has incorrect group or resource, it returns unauthorized error", func(t *testing.T) {
		t.Parallel()

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		svName := "sv-test"
		svcIdentity := "svc"

		// Create auth context with incorrect group
		authCtx := createAuthContext(ctx, "default", []string{"wrong.group/securevalues/" + svName + ":decrypt"}, svcIdentity, types.TypeUser)

		// Setup service
		sut := testutils.Setup(t)

		// Create a secure value
		spec := secretv1beta1.SecureValueSpec{
			Description: "description",
			Decrypters:  []string{svcIdentity},
			Value:       ptr.To(secretv1beta1.NewExposedSecureValue("value")),
		}
		sv := &secretv1beta1.SecureValue{Spec: spec}
		sv.Name = svName
		sv.Namespace = "default"

		_, err := sut.CreateSv(authCtx, testutils.CreateSvWithSv(sv))
		require.NoError(t, err)

		exposed, err := sut.DecryptStorage.Decrypt(authCtx, "default", svName)
		require.Error(t, err)
		require.Equal(t, err.Error(), "not authorized")
		require.Empty(t, exposed)
	})

	// TODO: add more tests for keeper failure scenarios, lets see how the async work will change this though.
}

func createAuthContext(ctx context.Context, namespace string, permissions []string, svc string, identityType types.IdentityType) context.Context {
	requester := &identity.StaticRequester{
		Type:      identityType,
		Namespace: namespace,
		AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
			Rest: authn.AccessTokenClaims{
				Permissions:     permissions,
				ServiceIdentity: svc,
			},
		},
	}

	if identityType == types.TypeUser {
		requester.UserID = 1
	}

	return types.WithAuthInfo(ctx, requester)
}
