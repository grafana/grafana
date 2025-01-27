package reststorage

import (
	"context"
	"fmt"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
)

func NewFakeKeeperStore() contracts.KeeperStorage {
	return &fakeKeeperStorage{
		values: make(map[string]map[string]secretv0alpha1.Keeper),
	}
}

type fakeKeeperStorage struct {
	values map[string]map[string]secretv0alpha1.Keeper
}

func (s *fakeKeeperStorage) Create(ctx context.Context, k *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error) {
	fmt.Println("create keeper")
	v := *k
	ns, ok := s.values[k.Namespace]
	if !ok {
		ns = make(map[string]secretv0alpha1.Keeper)
	}
	ns[k.Name] = v
	s.values[k.Namespace] = ns

	return &v, nil
}

func (s *fakeKeeperStorage) Read(ctx context.Context, nn xkube.NameNamespace) (*secretv0alpha1.Keeper, error) {
	fmt.Println("read keeper")
	ns, ok := s.values[nn.Namespace.String()]
	if !ok {
		return nil, fmt.Errorf("not found")
	}
	v, ok := ns[nn.Name]
	if !ok {
		return nil, fmt.Errorf("not found")
	}
	return &v, nil
}

func (s *fakeKeeperStorage) Update(ctx context.Context, nk *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error) {
	fmt.Println("update keeper")
	v := *nk
	ns, ok := s.values[nk.Namespace]
	if !ok {
		return nil, fmt.Errorf("not found")
	}
	_, ok = ns[nk.Name]
	if !ok {
		return nil, fmt.Errorf("not found")
	}
	ns[nk.Name] = v
	s.values[nk.Namespace] = ns

	return &v, nil
}

func (s *fakeKeeperStorage) Delete(ctx context.Context, nn xkube.NameNamespace) error {
	fmt.Println("delete keeper")
	ns, ok := s.values[nn.Namespace.String()]
	if !ok {
		return fmt.Errorf("not found")
	}
	_, ok = ns[nn.Name]
	if !ok {
		return fmt.Errorf("not found")
	}
	delete(ns, nn.Name)
	return nil
}

func (s *fakeKeeperStorage) List(ctx context.Context, namespace xkube.Namespace, options *internalversion.ListOptions) (*secretv0alpha1.KeeperList, error) {
	fmt.Println("list keepers")
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
