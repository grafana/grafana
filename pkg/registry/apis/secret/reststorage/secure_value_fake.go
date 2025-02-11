package reststorage

import (
	"context"
	"strconv"
	"time"

	"github.com/google/uuid"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

func NewFakeSecureValueStore(latency time.Duration) contracts.SecureValueStorage {
	return &fakeSecureValueStorage{
		values:  make(map[string]map[string]secretv0alpha1.SecureValue),
		latency: latency,
	}
}

type fakeSecureValueStorage struct {
	values  map[string]map[string]secretv0alpha1.SecureValue
	latency time.Duration
}

func (s *fakeSecureValueStorage) Create(ctx context.Context, sv *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error) {
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

func (s *fakeSecureValueStorage) Read(ctx context.Context, name string, namespace string) (*secretv0alpha1.SecureValue, error) {
	ns, ok := s.values[namespace]
	if !ok {
		return nil, contracts.ErrSecureValueNotFound
	}
	v, ok := ns[name]
	if !ok {
		return nil, contracts.ErrSecureValueNotFound
	}

	return &v, nil
}

func (s *fakeSecureValueStorage) Update(ctx context.Context, nsv *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error) {
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

func (s *fakeSecureValueStorage) Delete(ctx context.Context, name string, namespace string) error {
	ns, ok := s.values[namespace]
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

func (s *fakeSecureValueStorage) List(ctx context.Context, namespace string, options *internalversion.ListOptions) (*secretv0alpha1.SecureValueList, error) {
	ns, ok := s.values[namespace]
	if !ok {
		ns = make(map[string]secretv0alpha1.SecureValue)
		s.values[namespace] = ns
	}
	l := make([]secretv0alpha1.SecureValue, len(ns))
	for _, v := range ns {
		l = append(l, v)
	}
	return &secretv0alpha1.SecureValueList{
		Items: l,
	}, nil
}
