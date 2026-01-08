package decrypt

import (
	"context"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

type LocalDecryptClient struct {
	decryptStorage contracts.DecryptStorage
}

var _ decrypt.DecryptService = &LocalDecryptClient{}

func NewLocalDecryptClient(decryptStorage contracts.DecryptStorage) (*LocalDecryptClient, error) {
	return &LocalDecryptClient{
		decryptStorage: decryptStorage,
	}, nil
}

func (c *LocalDecryptClient) Decrypt(ctx context.Context, serviceName, namespace string, names ...string) (map[string]decrypt.DecryptResult, error) {
	ns, err := types.ParseNamespace(namespace)
	if err != nil {
		return nil, err
	}

	ctx = identity.WithServiceIdentityContext(ctx, ns.OrgID, identity.WithServiceIdentityName(serviceName))

	results := make(map[string]decrypt.DecryptResult, len(names))

	for _, name := range names {
		_, found := results[name]
		if found || name == "" {
			continue // no need to decrypt
		}
		exposedSecureValue, err := c.decryptStorage.Decrypt(ctx, xkube.Namespace(namespace), name)
		if err != nil {
			results[name] = decrypt.NewDecryptResultErr(err)
		} else {
			results[name] = decrypt.NewDecryptResultValue(&exposedSecureValue)
		}
	}

	return results, nil
}
