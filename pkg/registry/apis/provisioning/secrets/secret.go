package secrets

import (
	"context"
	"errors"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/secret"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

const svcName = "provisioning"

//go:generate mockery --name SecureValueClient --structname MockSecureValueClient --inpackage --filename secure_value_client_mock.go --with-expecter
type SecureValueClient = secret.SecureValueClient

//go:generate mockery --name Service --structname MockService --inpackage --filename secret_mock.go --with-expecter
type Service interface {
	Encrypt(ctx context.Context, namespace, name string, data string) (string, error)
	Decrypt(ctx context.Context, namespace string, name string) ([]byte, error)
	Delete(ctx context.Context, namespace string, name string) error
}

var _ Service = (*secretsService)(nil)

//go:generate mockery --name DecryptService --structname MockDecryptService --srcpkg=github.com/grafana/grafana/pkg/registry/apis/secret --filename decrypt_service_mock.go --with-expecter
type secretsService struct {
	secureValues SecureValueClient
	decryptSvc   secret.DecryptService
}

func NewSecretsService(secretsSvc SecureValueClient, decryptSvc secret.DecryptService) Service {
	return &secretsService{
		secureValues: secretsSvc,
		decryptSvc:   decryptSvc,
	}
}

func (s *secretsService) Encrypt(ctx context.Context, namespace, name string, data string) (string, error) {
	client, err := s.secureValues.Client(ctx, namespace)
	if err != nil {
		return "", err
	}

	// Try to get existing secret
	existingUnstructured, err := client.Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		// If secret doesn't exist (not found error), we'll create it
		// For other errors, return the error
		if !errors.Is(err, contracts.ErrSecureValueNotFound) {
			// Check if it's a k8s not found error
			if !isNotFoundError(err) {
				return "", err
			}
		}
	}

	if existingUnstructured != nil {
		// Update the value directly in the unstructured object
		if err := unstructured.SetNestedField(existingUnstructured.Object, data, "spec", "value"); err != nil {
			return "", err
		}

		// Update using dynamic client
		result, err := client.Update(ctx, existingUnstructured, metav1.UpdateOptions{})
		if err != nil {
			return "", err
		}

		return result.GetName(), nil
	}

	// Create the secret directly as unstructured
	secret := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "secret.grafana.app/v1beta1",
			"kind":       "SecureValue",
			"metadata": map[string]interface{}{
				"namespace": namespace,
				"name":      name,
			},
			"spec": map[string]interface{}{
				"description": "provisioning: " + name,
				"value":       data,
				"decrypters":  []string{svcName},
			},
		},
	}

	// Create new secret
	finalSecret, err := client.Create(ctx, secret, metav1.CreateOptions{})
	if err != nil {
		return "", err
	}

	return finalSecret.GetName(), nil
}

func (s *secretsService) Decrypt(ctx context.Context, namespace string, name string) ([]byte, error) {
	ns, err := types.ParseNamespace(namespace)
	if err != nil {
		return nil, err
	}
	ctx = identity.WithServiceIdentityContext(ctx, ns.OrgID, identity.WithServiceIdentityName(svcName))

	results, err := s.decryptSvc.Decrypt(ctx, namespace, name)
	if err != nil {
		return nil, err
	}

	if res, ok := results[name]; ok {
		if res.Error() == nil {
			return []byte(res.Value().DangerouslyExposeAndConsumeValue()), nil
		}

		return nil, res.Error()
	}

	return nil, contracts.ErrDecryptNotFound
}

func (s *secretsService) Delete(ctx context.Context, namespace string, name string) error {
	ns, err := types.ParseNamespace(namespace)
	if err != nil {
		return err
	}

	ctx = identity.WithServiceIdentityContext(ctx, ns.OrgID, identity.WithServiceIdentityName(svcName))
	client, err := s.secureValues.Client(ctx, namespace)
	if err != nil {
		return err
	}

	if err := client.Delete(ctx, name, metav1.DeleteOptions{}); err != nil {
		// FIXME: This is a temporary workaround until the client abstraction properly handles
		// k8s not found errors. The client should normalize these errors to return contracts.ErrSecureValueNotFound
		if isNotFoundError(err) {
			return contracts.ErrSecureValueNotFound
		}
		return err
	}

	return nil
}

// Helper function to check if error is a not found error
// FIXME: This is a temporary workaround until the client abstraction properly handles
// k8s not found errors. The client should normalize these errors to return contracts.ErrSecureValueNotFound
func isNotFoundError(err error) bool {
	if err == nil {
		return false
	}

	// Check for Grafana's secure value not found error
	if errors.Is(err, contracts.ErrSecureValueNotFound) {
		return true
	}

	// Check for k8s not found error
	if apierrors.IsNotFound(err) {
		return true
	}

	// Fallback for generic not found error messages
	return err.Error() == "not found"
}
