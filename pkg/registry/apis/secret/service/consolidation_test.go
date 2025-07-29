package service_test

import (
	"context"
	"testing"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/service"
	"github.com/grafana/grafana/pkg/registry/apis/secret/testutils"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"
)

// mockGlobalEncryptedValueStorage wraps the real storage and allows injecting behavior during ListAll
type mockGlobalEncryptedValueStorage struct {
	real      contracts.GlobalEncryptedValueStorage
	sut       *testutils.Sut
	ctx       context.Context
	onListAll func()
}

func (m *mockGlobalEncryptedValueStorage) ListAll(ctx context.Context, opts contracts.ListOpts, untilTime *int64) ([]*contracts.EncryptedValue, error) {
	if m.onListAll != nil {
		m.onListAll()
	}
	return m.real.ListAll(ctx, opts, untilTime)
}

func (m *mockGlobalEncryptedValueStorage) CountAll(ctx context.Context, untilTime *int64) (int64, error) {
	return m.real.CountAll(ctx, untilTime)
}

func TestConsolidation(t *testing.T) {
	t.Parallel()

	t.Run("consolidation re-encrypts values but preserves decrypted content", func(t *testing.T) {
		t.Parallel()
		sut := testutils.Setup(t)

		ctx := context.Background()
		createAuthContext := func(ctx context.Context, namespace string, identityType types.IdentityType) context.Context {
			return types.WithAuthInfo(ctx, &identity.StaticRequester{
				Type:      identityType,
				Namespace: namespace,
				AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
					Rest: authn.AccessTokenClaims{
						Permissions:     []string{"secret.grafana.app/securevalues:decrypt"},
						ServiceIdentity: "decrypter1",
					},
				},
			})
		}

		// Create several secure values in different namespaces
		testCases := []struct {
			name      string
			namespace string
			value     string
		}{
			{"test-secret-1", "namespace1", "test-value-1"},
			{"test-secret-2", "namespace1", "test-value-2"},
			{"test-secret-3", "namespace2", "test-value-3"},
			{"test-secret-4", "namespace2", "test-value-4"},
		}

		var createdSecrets []*secretv1beta1.SecureValue
		var originalDecryptedValues []string
		var originalEncryptedData [][]byte

		// Create secure values and store their original decrypted values and encrypted data
		for _, tc := range testCases {
			sv := &secretv1beta1.SecureValue{
				ObjectMeta: metav1.ObjectMeta{
					Name:      tc.name,
					Namespace: tc.namespace,
				},
				Spec: secretv1beta1.SecureValueSpec{
					Value:      ptr.To(secretv1beta1.NewExposedSecureValue(tc.value)),
					Decrypters: []string{"decrypter1"},
				},
			}

			createdSv, err := sut.CreateSv(ctx, testutils.CreateSvWithSv(sv))
			require.NoError(t, err)
			createdSecrets = append(createdSecrets, createdSv)

			// Store the original decrypted data and encrypted data
			authCtx := createAuthContext(ctx, tc.namespace, types.TypeAccessPolicy)
			decryptedValue, err := sut.DecryptStorage.Decrypt(authCtx, xkube.Namespace(tc.namespace), tc.name)
			require.NoError(t, err)
			originalDecryptedValues = append(originalDecryptedValues, decryptedValue.DangerouslyExposeAndConsumeValue())

			encryptedValue, err := sut.EncryptedValueStorage.Get(ctx, tc.namespace, tc.name, 1)
			require.NoError(t, err)
			require.NotNil(t, encryptedValue)
			originalEncryptedData = append(originalEncryptedData, encryptedValue.EncryptedData)
		}

		// Run consolidation
		err := sut.ConsolidationService.Consolidate(ctx)
		require.NoError(t, err)

		for i, tc := range testCases {
			// Verify that the decrypted values are still the same
			authCtx := createAuthContext(ctx, tc.namespace, types.TypeAccessPolicy)
			decryptedValue, err := sut.DecryptStorage.Decrypt(authCtx, xkube.Namespace(tc.namespace), tc.name)
			require.NoError(t, err)
			require.Equal(t, originalDecryptedValues[i], decryptedValue.DangerouslyExposeAndConsumeValue())

			// Verify that the encrypted data has changed (indicating re-encryption)
			encryptedValue, err := sut.EncryptedValueStorage.Get(ctx, tc.namespace, tc.name, 1)
			require.NoError(t, err)
			require.NotEqual(t, originalEncryptedData[i], encryptedValue.EncryptedData)
		}
	})

	t.Run("consolidation handles secrets created during the process", func(t *testing.T) {
		t.Parallel()
		sut := testutils.Setup(t)

		ctx := context.Background()
		createAuthContext := func(ctx context.Context, namespace string, identityType types.IdentityType) context.Context {
			return types.WithAuthInfo(ctx, &identity.StaticRequester{
				Type:      identityType,
				Namespace: namespace,
				AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
					Rest: authn.AccessTokenClaims{
						Permissions:     []string{"secret.grafana.app/securevalues:decrypt"},
						ServiceIdentity: "decrypter1",
					},
				},
			})
		}

		// Create initial secure values
		initialSecrets := []struct {
			name      string
			namespace string
			value     string
		}{
			{"initial-secret-1", "namespace1", "initial-value-1"},
			{"initial-secret-2", "namespace2", "initial-value-2"},
		}

		var initialDecryptedValues []string
		var initialEncryptedData [][]byte

		for _, tc := range initialSecrets {
			sv := &secretv1beta1.SecureValue{
				ObjectMeta: metav1.ObjectMeta{
					Name:      tc.name,
					Namespace: tc.namespace,
				},
				Spec: secretv1beta1.SecureValueSpec{
					Value:      ptr.To(secretv1beta1.NewExposedSecureValue(tc.value)),
					Decrypters: []string{"decrypter1"},
				},
			}

			_, err := sut.CreateSv(ctx, testutils.CreateSvWithSv(sv))
			require.NoError(t, err)

			// Store original decrypted values and encrypted data
			authCtx := createAuthContext(ctx, tc.namespace, types.TypeAccessPolicy)
			decryptedValue, err := sut.DecryptStorage.Decrypt(authCtx, xkube.Namespace(tc.namespace), tc.name)
			require.NoError(t, err)
			initialDecryptedValues = append(initialDecryptedValues, decryptedValue.DangerouslyExposeAndConsumeValue())

			encryptedValue, err := sut.EncryptedValueStorage.Get(ctx, tc.namespace, tc.name, 1)
			require.NoError(t, err)
			initialEncryptedData = append(initialEncryptedData, encryptedValue.EncryptedData)
		}

		// Secrets to be created during consolidation (after data keys are disabled)
		var newSecretDecryptedValues []string
		var newSecretEncryptedData [][]byte

		// Create a mock GlobalEncryptedValueStorage that will create new secrets when ListAll is called
		mockStorage := &mockGlobalEncryptedValueStorage{
			real: sut.GlobalEncryptedValueStorage,
			sut:  &sut,
			ctx:  ctx,
			onListAll: func() {
				// This function is called during consolidation, after data keys are disabled
				// but before the re-encryption loop begins
				newSecrets := []struct {
					name      string
					namespace string
					value     string
					desc      string
				}{
					{"new-secret-1", "namespace1", "new-value-1", "New secret created during consolidation"},
					{"new-secret-2", "namespace3", "new-value-2", "Another new secret during consolidation"},
				}

				for _, tc := range newSecrets {
					sv := &secretv1beta1.SecureValue{
						ObjectMeta: metav1.ObjectMeta{
							Name:      tc.name,
							Namespace: tc.namespace,
						},
						Spec: secretv1beta1.SecureValueSpec{
							Description: tc.desc,
							Value:       ptr.To(secretv1beta1.NewExposedSecureValue(tc.value)),
							Decrypters:  []string{"decrypter1"},
						},
					}

					_, err := sut.CreateSv(ctx, testutils.CreateSvWithSv(sv))
					require.NoError(t, err)

					// Store their decrypted values and original encrypted data
					authCtx := createAuthContext(ctx, tc.namespace, types.TypeAccessPolicy)
					decryptedValue, err := sut.DecryptStorage.Decrypt(authCtx, xkube.Namespace(tc.namespace), tc.name)
					require.NoError(t, err)
					newSecretDecryptedValues = append(newSecretDecryptedValues, decryptedValue.DangerouslyExposeAndConsumeValue())

					encryptedValue, err := sut.EncryptedValueStorage.Get(ctx, tc.namespace, tc.name, 1)
					require.NoError(t, err)
					newSecretEncryptedData = append(newSecretEncryptedData, encryptedValue.EncryptedData)
				}
			},
		}

		// Create a custom consolidation service that uses the mocked storage
		tracer := noop.NewTracerProvider().Tracer("test")
		customConsolidationService := service.ProvideConsolidationService(
			tracer,
			sut.GlobalDataKeyStore,
			sut.EncryptedValueStorage,
			mockStorage,
			sut.EncryptionManager,
		)

		// Run consolidation
		err := customConsolidationService.Consolidate(ctx)
		require.NoError(t, err)

		for i, tc := range initialSecrets {
			// Verify that all initial secrets still decrypt to the same values
			authCtx := createAuthContext(ctx, tc.namespace, types.TypeAccessPolicy)
			decryptedValue, err := sut.DecryptStorage.Decrypt(authCtx, xkube.Namespace(tc.namespace), tc.name)
			require.NoError(t, err)
			require.Equal(t, initialDecryptedValues[i], decryptedValue.DangerouslyExposeAndConsumeValue())

			// Verify that the encrypted data has changed (indicating re-encryption)
			encryptedValue, err := sut.EncryptedValueStorage.Get(ctx, tc.namespace, tc.name, 1)
			require.NoError(t, err)
			require.NotEqual(t, initialEncryptedData[i], encryptedValue.EncryptedData)
		}

		// Verify that the new secrets (created during consolidation) also decrypt correctly
		// These secrets should have been re-encrypted as well during the consolidation process
		newSecrets := []struct {
			name      string
			namespace string
		}{
			{"new-secret-1", "namespace1"},
			{"new-secret-2", "namespace3"},
		}

		for i, tc := range newSecrets {
			authCtx := createAuthContext(ctx, tc.namespace, types.TypeAccessPolicy)
			decryptedValue, err := sut.DecryptStorage.Decrypt(authCtx, xkube.Namespace(tc.namespace), tc.name)
			require.NoError(t, err)
			require.Equal(t, newSecretDecryptedValues[i], decryptedValue.DangerouslyExposeAndConsumeValue())

			// Verify that the encrypted data has changed from what it was when first created
			// (indicating it was re-encrypted during consolidation)
			encryptedValue, err := sut.EncryptedValueStorage.Get(ctx, tc.namespace, tc.name, 1)
			require.NoError(t, err)
			require.NotEqual(t, newSecretEncryptedData[i], encryptedValue.EncryptedData)
		}
	})
}
