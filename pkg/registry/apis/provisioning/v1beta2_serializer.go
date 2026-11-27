package provisioning

import (
	"context"
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

// v1beta2StorageSerializer persists v1beta2 objects as v1beta2StorageVersion, so older Grafana
// versions, search, the controllers and enterprise all keep seeing one shape. It decodes any
// stored version the storage version's Go types accept, which includes v1beta1.
type v1beta2StorageSerializer struct {
	scheme *runtime.Scheme
}

var _ apistore.Serializer = (*v1beta2StorageSerializer)(nil)

func (s *v1beta2StorageSerializer) Encode(ctx context.Context, obj runtime.Object) (json.RawMessage, error) {
	stored, err := toStorageVersion(s.scheme, obj)
	if err != nil {
		return nil, err
	}
	return apistore.JSONSerializer().Encode(ctx, stored)
}

func (s *v1beta2StorageSerializer) Decode(ctx context.Context, data []byte, into runtime.Object) (runtime.Object, error) {
	if into == nil {
		return nil, fmt.Errorf("decoding %s requires a destination object", v1beta2StorageVersion)
	}
	kind, ok := v1beta2Kind(s.scheme, into)
	if !ok {
		return nil, fmt.Errorf("unexpected destination %T", into)
	}
	stored, err := s.scheme.New(v1beta2StorageVersion.WithKind(kind.Kind))
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(data, stored); err != nil {
		return nil, err
	}
	if err := fromStorageVersion(s.scheme, stored, into); err != nil {
		return nil, err
	}
	return into, nil
}
