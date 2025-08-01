package decrypt

import (
	"context"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

type LocalDecryptClient struct {
	decryptStorage contracts.DecryptStorage
}

var _ contracts.DecryptService = &LocalDecryptClient{}

func NewLocalDecryptClient(decryptStorage contracts.DecryptStorage) (*LocalDecryptClient, error) {
	return &LocalDecryptClient{
		decryptStorage: decryptStorage,
	}, nil
}

func (c *LocalDecryptClient) Decrypt(ctx context.Context, namespace string, names ...string) (map[string]contracts.DecryptResult, error) {
	results := make(map[string]contracts.DecryptResult, len(names))

	for _, name := range names {
		exposedSecureValue, err := c.decryptStorage.Decrypt(ctx, xkube.Namespace(namespace), name)
		if err != nil {
			results[name] = contracts.NewDecryptResultErr(err)
		} else {
			results[name] = contracts.NewDecryptResultValue(&exposedSecureValue)
		}
	}

	return results, nil
}

func (c *LocalDecryptClient) Close() error {
	return nil
}
