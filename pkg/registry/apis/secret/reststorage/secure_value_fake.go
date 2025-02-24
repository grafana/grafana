package reststorage

import (
	"context"
	"strconv"
	"time"

	"github.com/google/uuid"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

func NewFakeSecureValueMetadataStore(latency time.Duration) contracts.SecureValueMetadataStorage {
	return &fakeSecureValueMetadataStorage{
		values:  make(map[string]map[string]secretv0alpha1.SecureValue),
		latency: latency,
	}
}

type fakeSecureValueMetadataStorage struct {
	values  map[string]map[string]secretv0alpha1.SecureValue
	latency time.Duration
}

func (s *fakeSecureValueMetadataStorage) Create(ctx context.Context, sv *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error) {
	v := *sv
	v.SetUID(types.UID(uuid.NewString()))
	v.ObjectMeta.SetResourceVersion(strconv.FormatInt(metav1.Now().UnixMicro(), 10))
	v.Spec.Value = ""
	ns, ok := s.values[sv.Namespace]
	if !ok {
		ns = make(map[string]secretv0alpha1.SecureValue)
		s.values[sv.Namespace] = ns
	}
	time.AfterFunc(s.latency, func() {
		ns[sv.Name] = v
	})

	return &v, nil
}

func (s *fakeSecureValueMetadataStorage) Read(ctx context.Context, namespace xkube.Namespace, name string) (*secretv0alpha1.SecureValue, error) {
	ns, ok := s.values[namespace.String()]
	if !ok {
		return nil, contracts.ErrSecureValueNotFound
	}
	v, ok := ns[name]
	if !ok {
		return nil, contracts.ErrSecureValueNotFound
	}

	return &v, nil
}

func (s *fakeSecureValueMetadataStorage) Update(ctx context.Context, nsv *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error) {
	v := *nsv
	v.Spec.Value = ""
	v.SetResourceVersion(strconv.FormatInt(metav1.Now().UnixMicro(), 10))
	ns, ok := s.values[nsv.Namespace]
	if !ok {
		return nil, contracts.ErrSecureValueNotFound
	}
	_, ok = ns[nsv.Name]
	if !ok {
		return nil, contracts.ErrSecureValueNotFound
	}
	time.AfterFunc(s.latency, func() {
		ns[nsv.Name] = v
	})

	return &v, nil
}

func (s *fakeSecureValueMetadataStorage) Delete(ctx context.Context, namespace xkube.Namespace, name string) error {
	ns, ok := s.values[namespace.String()]
	if !ok {
		return contracts.ErrSecureValueNotFound
	}
	_, ok = ns[name]
	if !ok {
		return contracts.ErrSecureValueNotFound
	}
	time.AfterFunc(s.latency, func() {
		delete(ns, name)
	})

	return nil
}

func (s *fakeSecureValueMetadataStorage) List(ctx context.Context, namespace xkube.Namespace, options *internalversion.ListOptions) (*secretv0alpha1.SecureValueList, error) {
	ns, ok := s.values[namespace.String()]
	if !ok {
		ns = make(map[string]secretv0alpha1.SecureValue)
		s.values[namespace.String()] = ns
	}
	l := make([]secretv0alpha1.SecureValue, len(ns))
	for _, v := range ns {
		l = append(l, v)
	}
	return &secretv0alpha1.SecureValueList{
		Items: l,
	}, nil
}
