package secure

import (
	"context"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

// HACK: this interface and struct are used to avoid the dependency on the secret contracts
// "github.com/grafana/grafana/pkg/registry/apis/secret/contracts" which creates a circular dependency
// between the apps/provisioning and root modules.
type wrapper struct {
	svc contracts.DecryptService
}

func (w *wrapper) Decrypt(ctx context.Context, group, namespace string, names ...string) (map[string]repository.DecryptResult, error) {
	values, err := w.svc.Decrypt(ctx, group, namespace, names...)
	if err != nil {
		return nil, err
	}

	results := make(map[string]repository.DecryptResult, len(values))
	for k, v := range values {
		results[k] = repository.DecryptResult{
			Val: v.Value(),
			Err: v.Error(),
		}
	}

	return results, nil
}

func ProvideDecryptService(svc contracts.DecryptService) repository.DecryptService {
	return &wrapper{svc: svc}
}
