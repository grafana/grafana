package types

import (
	"context"
	"encoding/json"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
)

var (
	_ rest.Storage              = (*queryTypeStorage)(nil)
	_ rest.Scoper               = (*queryTypeStorage)(nil)
	_ rest.SingularNameProvider = (*queryTypeStorage)(nil)
	_ rest.Lister               = (*queryTypeStorage)(nil)
)

type queryTypeStorage struct {
	resourceInfo   *common.ResourceInfo
	tableConverter rest.TableConvertor
	registry       query.QueryTypeDefinitionList
}

func RegisterQueryTypes(raw json.RawMessage, storage map[string]rest.Storage) error {
	if len(raw) < 1 {
		return nil // NO error
	}

	var resourceInfo = query.QueryTypeDefinitionResourceInfo
	store := &queryTypeStorage{
		resourceInfo:   &resourceInfo,
		tableConverter: rest.NewDefaultTableConvertor(resourceInfo.GroupResource()),
	}

	err := json.Unmarshal(raw, &store.registry)
	if err != nil {
		return err
	}
	storage[resourceInfo.StoragePath()] = store

	return err // nil
}

func (s *queryTypeStorage) New() runtime.Object {
	return s.resourceInfo.NewFunc()
}

func (s *queryTypeStorage) Destroy() {}

func (s *queryTypeStorage) NamespaceScoped() bool {
	return false
}

func (s *queryTypeStorage) GetSingularName() string {
	return s.resourceInfo.GetSingularName()
}

func (s *queryTypeStorage) NewList() runtime.Object {
	return s.resourceInfo.NewListFunc()
}

func (s *queryTypeStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *queryTypeStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return &s.registry, nil
}
