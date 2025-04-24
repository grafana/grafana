package decrypt

import (
	"context"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

type OSSDecryptService struct {
	decryptStore contracts.DecryptStorage
}

var _ contracts.DecryptService = &OSSDecryptService{}

func ProvideDecryptService(decryptStore contracts.DecryptStorage) *OSSDecryptService {
	return &OSSDecryptService{
		decryptStore: decryptStore,
	}
}

func (d *OSSDecryptService) Decrypt(ctx context.Context, namespace string, names ...string) (map[string]contracts.DecryptResult, error) {
	results := make(map[string]contracts.DecryptResult, len(names))

	for _, name := range names {
		exposedSecureValue, err := d.decryptStore.Decrypt(ctx, xkube.Namespace(namespace), name)
		if err != nil {
			results[name] = contracts.NewDecryptResultErr(err)
		} else {
			results[name] = contracts.NewDecryptResultValue(&exposedSecureValue)
		}
	}

	return results, nil
}
