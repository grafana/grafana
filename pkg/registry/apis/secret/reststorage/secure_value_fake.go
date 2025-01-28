package reststorage

import (
	"context"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
)

func NewFakeSecureValueStore() contracts.SecureValueStorage {
	return &fakeSecureValueStorage{
		values: make(map[string]map[string]secretv0alpha1.SecureValue),
	}
}

type fakeSecureValueStorage struct {
	values map[string]map[string]secretv0alpha1.SecureValue
}

func (s *fakeSecureValueStorage) Create(ctx context.Context, sv *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error) {
	v := *sv
	v.Spec.Value = ""
	ns, ok := s.values[sv.Namespace]
	if !ok {
		ns = make(map[string]secretv0alpha1.SecureValue)
	}
	ns[sv.Name] = v
	s.values[sv.Namespace] = ns

	return &v, nil
}

func (s *fakeSecureValueStorage) Read(ctx context.Context, nn xkube.NameNamespace) (*secretv0alpha1.SecureValue, error) {
	ns, ok := s.values[nn.Namespace.String()]
	if !ok {
		return nil, contracts.ErrSecureValueNotFound
	}
	v, ok := ns[nn.Name]
	if !ok {
		return nil, contracts.ErrSecureValueNotFound
	}
	return &v, nil
}

func (s *fakeSecureValueStorage) Update(ctx context.Context, nsv *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error) {
	v := *nsv
	v.Spec.Value = ""
	ns, ok := s.values[nsv.Namespace]
	if !ok {
		return nil, contracts.ErrSecureValueNotFound
	}
	_, ok = ns[nsv.Name]
	if !ok {
		return nil, contracts.ErrSecureValueNotFound
	}
	ns[nsv.Name] = v
	s.values[nsv.Namespace] = ns

	return &v, nil
}

func (s *fakeSecureValueStorage) Delete(ctx context.Context, nn xkube.NameNamespace) error {
	ns, ok := s.values[nn.Namespace.String()]
	if !ok {
		return contracts.ErrSecureValueNotFound
	}
	_, ok = ns[nn.Name]
	if !ok {
		return contracts.ErrSecureValueNotFound
	}
	delete(ns, nn.Name)
	return nil
}

func (s *fakeSecureValueStorage) List(ctx context.Context, namespace xkube.Namespace, options *internalversion.ListOptions) (*secretv0alpha1.SecureValueList, error) {
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
