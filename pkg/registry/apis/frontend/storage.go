package frontend

import (
	"context"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	common "github.com/grafana/grafana/pkg/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apis/frontend/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/utils"
)

var (
	_ rest.Storage              = (*extensionStorage)(nil)
	_ rest.Scoper               = (*extensionStorage)(nil)
	_ rest.SingularNameProvider = (*extensionStorage)(nil)
	_ rest.Lister               = (*extensionStorage)(nil)
)

type extensionStorage struct {
	info           common.ResourceInfo
	tableConverter rest.TableConvertor
}

func newStaticStorage() *extensionStorage {
	info := v0alpha1.ExtensionResourceInfo
	return &extensionStorage{
		info: info,
		tableConverter: utils.NewTableConverter(
			info.GroupResource(),
			[]metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "Title", Type: "string", Format: "string", Description: "The extension name"},
				{Name: "Assets", Type: "string", Format: "string", Description: "where to load the assets"},
				{Name: "Created At", Type: "date"},
			},
			func(obj any) ([]interface{}, error) {
				m, ok := obj.(*v0alpha1.ExtensionResource)
				if !ok {
					return nil, fmt.Errorf("expected playlist")
				}
				return []interface{}{
					m.Name,
					m.Spec.Title,
					m.Spec.Assets,
					m.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			},
		),
	}
}

func (s *extensionStorage) New() runtime.Object {
	return s.info.NewFunc()
}

func (s *extensionStorage) Destroy() {}

func (s *extensionStorage) NamespaceScoped() bool {
	return true // per tenant configuration
}

func (s *extensionStorage) GetSingularName() string {
	return s.info.GetSingularName()
}

func (s *extensionStorage) NewList() runtime.Object {
	return s.info.NewListFunc()
}

func (s *extensionStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *extensionStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	ns := request.NamespaceValue(ctx)
	if ns == "" {
		// require a namespace so we do not need to support reverse mappings (yet)
		return nil, fmt.Errorf("missing namespace in request URL")
	}

	return &v0alpha1.ExtensionResourceList{
		Items: []v0alpha1.ExtensionResource{
			{
				ObjectMeta: metav1.ObjectMeta{
					Name:              "grafana",
					Namespace:         ns,
					CreationTimestamp: metav1.Now(),
				},
				Spec: v0alpha1.ExtensionInfo{
					Title:       "Grafana Core",
					Description: "the core frontend version",
					Version:     "10.3.0-pre",
					Assets:      "https://grafana-assets.grafana.net/grafana/10.3.0-64796/public/",
				},
			},
			// Cloud app plugins
			{
				ObjectMeta: metav1.ObjectMeta{
					Name:              "grafana-incident-app",
					Namespace:         ns,
					CreationTimestamp: metav1.Now(),
				},
				Spec: v0alpha1.ExtensionInfo{
					Title:   "Incident (app)",
					Version: "1.35.1",
					Assets:  "https://grafana-assets.grafana.net/apps/grafana-incident-app/vXXXXX",
					Module:  "module.js", // added to the Asset path
				},
			},
		},
	}, nil
}
