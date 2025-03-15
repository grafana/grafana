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

func NewFakeKeeperMetadataStore(latency time.Duration) contracts.KeeperMetadataStorage {
	return &fakeKeeperMetadataStorage{
		values:  make(map[string]map[string]secretv0alpha1.Keeper),
		latency: latency,
	}
}

type fakeKeeperMetadataStorage struct {
	values  map[string]map[string]secretv0alpha1.Keeper
	latency time.Duration
}

func (s *fakeKeeperMetadataStorage) Create(ctx context.Context, k *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error) {
	v := *k
	v.SetUID(types.UID(uuid.NewString()))
	v.ObjectMeta.SetResourceVersion(strconv.FormatInt(metav1.Now().UnixMicro(), 10))
	ns, ok := s.values[k.Namespace]
	if !ok {
		ns = make(map[string]secretv0alpha1.Keeper)
		s.values[k.Namespace] = ns
	}
	time.AfterFunc(s.latency, func() {
		ns[k.Name] = v
	})

	return &v, nil
}

func (s *fakeKeeperMetadataStorage) Read(ctx context.Context, namespace xkube.Namespace, name string) (*secretv0alpha1.Keeper, error) {
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

func (s *fakeKeeperMetadataStorage) Update(ctx context.Context, nk *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error) {
	v := *nk
	v.ObjectMeta.SetResourceVersion(strconv.FormatInt(metav1.Now().UnixMicro(), 10))
	ns, ok := s.values[nk.Namespace]
	if !ok {
		return nil, contracts.ErrSecureValueNotFound
	}
	_, ok = ns[nk.Name]
	if !ok {
		return nil, contracts.ErrSecureValueNotFound
	}
	time.AfterFunc(s.latency, func() {
		ns[nk.Name] = v
	})

	return &v, nil
}

func (s *fakeKeeperMetadataStorage) Delete(ctx context.Context, namespace xkube.Namespace, name string) error {
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

func (s *fakeKeeperMetadataStorage) List(ctx context.Context, namespace xkube.Namespace, options *internalversion.ListOptions) (*secretv0alpha1.KeeperList, error) {
	ns, ok := s.values[namespace.String()]
	if !ok {
		s.values[namespace.String()] = ns
	}
	l := make([]secretv0alpha1.Keeper, len(ns))
	for _, v := range ns {
		l = append(l, v)
	}
	return &secretv0alpha1.KeeperList{
		Items: l,
	}, nil
}
