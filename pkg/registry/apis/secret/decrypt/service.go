package decrypt

import (
	"context"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/service"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

type OSSDecryptService struct {
	decryptStore contracts.DecryptStorage
}

var _ service.DecryptService = &OSSDecryptService{}

func ProvideDecryptService(decryptStore contracts.DecryptStorage) *OSSDecryptService {
	return &OSSDecryptService{
		decryptStore: decryptStore,
	}
}

func (d *OSSDecryptService) Decrypt(ctx context.Context, namespace string, names ...string) (map[string]service.DecryptResult, error) {
	results := make(map[string]service.DecryptResult, len(names))

	for _, name := range names {
		exposedSecureValue, err := d.decryptStore.Decrypt(ctx, xkube.Namespace(namespace), name)
		if err != nil {
			results[name] = service.NewDecryptResultErr(err)
		} else {
			results[name] = service.NewDecryptResultValue(&exposedSecureValue)
		}
	}

	return results, nil
}
