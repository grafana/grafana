package secrets

import (
	"context"
	"errors"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	grafanasecrets "github.com/grafana/grafana/pkg/registry/apis/secret/service"
	"github.com/grafana/grafana/pkg/services/secrets"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const svcName = "provisioning"

//go:generate mockery --name Service --structname MockService --inpackage --filename secret_mock.go --with-expecter
type Service interface {
	Encrypt(ctx context.Context, namespace, name string, data string) ([]byte, error)
	Decrypt(ctx context.Context, namespace string, name []byte) ([]byte, error)
}

var _ Service = (*secretsService)(nil)

type secretsService struct {
	legacySvc  secrets.Service
	secretsSvc *grafanasecrets.SecureValueService
	decryptSvc grafanasecrets.DecryptService
}

func NewSecretsService(legacySvc secrets.Service, secretsSvc *grafanasecrets.SecureValueService, decryptSvc grafanasecrets.DecryptService) *secretsService {
	return &secretsService{
		legacySvc:  legacySvc,
		secretsSvc: secretsSvc,
		decryptSvc: decryptSvc,
	}
}

func (s *secretsService) Encrypt(ctx context.Context, namespace, name string, data string) ([]byte, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
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

	finalSecret, err := s.secretsSvc.Create(ctx, secret, user.GetUID())
	if err != nil {
		return nil, nil
	}

	return []byte(finalSecret.GetName()), nil
}

func (s *secretsService) Decrypt(ctx context.Context, namespace string, name []byte) ([]byte, error) {
	requester := &identity.StaticRequester{
		Type:      types.TypeAccessPolicy,
		Namespace: namespace,
		AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
			Rest: authn.AccessTokenClaims{
				Permissions:     []string{"secret.grafana.app/securevalues:decrypt"},
				ServiceIdentity: svcName,
			},
		},
	}
	ctx = types.WithAuthInfo(ctx, requester)

	results, err := s.decryptSvc.Decrypt(ctx, namespace, string(name))
	if err != nil {
		return nil, err
	}

	if res, ok := results[string(name)]; ok {
		if res.Error() == nil {
			return []byte(res.Value().DangerouslyExposeAndConsumeValue()), nil
		}

		// if the secret is not found in the new secrets service,
		// fallback to the legacy store for backwards compatibility
		//
		// TODO: long term, we will want to migrate this data, but we should wait
		// until it is in the secure values section of the k8s object and migrate both
		// the location of the secret in the object and the data itself at the same time
		if errors.Is(res.Error(), contracts.ErrDecryptNotFound) {
			decrypted, err := s.legacySvc.Decrypt(ctx, name)
			if err != nil {
				return nil, err
			}

			return decrypted, nil
		}

		return nil, res.Error()
	}

	return nil, contracts.ErrDecryptNotFound
}
