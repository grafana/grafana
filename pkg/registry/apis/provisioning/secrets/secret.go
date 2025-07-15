package secrets

import (
	"context"
	"errors"

	"github.com/grafana/authlib/types"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	grafanasecrets "github.com/grafana/grafana/pkg/registry/apis/secret/service"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const svcName = "provisioning"

//go:generate mockery --name SecureValueService --structname MockSecureValueService --inpackage --filename secure_value_mock.go --with-expecter
type SecureValueService interface {
	Create(ctx context.Context, sv *secretv1beta1.SecureValue, actorUID string) (*secretv1beta1.SecureValue, error)
	Update(ctx context.Context, newSecureValue *secretv1beta1.SecureValue, actorUID string) (*secretv1beta1.SecureValue, bool, error)
	Read(ctx context.Context, namespace xkube.Namespace, name string) (*secretv1beta1.SecureValue, error)
}

//go:generate mockery --name Service --structname MockService --inpackage --filename secret_mock.go --with-expecter
type Service interface {
	Encrypt(ctx context.Context, namespace, name string, data string) (string, error)
	Decrypt(ctx context.Context, namespace string, name string) ([]byte, error)
}

var _ Service = (*secretsService)(nil)

//go:generate mockery --name DecryptService --structname MockDecryptService --srcpkg=github.com/grafana/grafana/pkg/registry/apis/secret/service --filename decrypt_service_mock.go --with-expecter
type secretsService struct {
	secretsSvc SecureValueService
	decryptSvc grafanasecrets.DecryptService
}

func NewSecretsService(secretsSvc SecureValueService, decryptSvc grafanasecrets.DecryptService) Service {
	return &secretsService{
		secretsSvc: secretsSvc,
		decryptSvc: decryptSvc,
	}
}

func (s *secretsService) Encrypt(ctx context.Context, namespace, name string, data string) (string, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return "", err
	}

	val := secretv1beta1.NewExposedSecureValue(data)
	secret := &secretv1beta1.SecureValue{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: namespace,
			Name:      name,
		},
		Spec: secretv1beta1.SecureValueSpec{
			Description: "provisioning: " + name,
			Value:       &val,
			Decrypters:  []string{svcName},
		},
	}

	existing, err := s.secretsSvc.Read(ctx, xkube.Namespace(namespace), name)
	if err != nil && !errors.Is(err, contracts.ErrSecureValueNotFound) {
		return "", err
	}

	if existing != nil {
		existing.Spec.Value = &val
		existing, _, err = s.secretsSvc.Update(ctx, existing, user.GetUID())
		if err != nil {
			return "", err
		}

		return existing.GetName(), nil
	}

	finalSecret, err := s.secretsSvc.Create(ctx, secret, user.GetUID())
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
