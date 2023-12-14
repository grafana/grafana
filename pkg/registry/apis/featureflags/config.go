package featureflags

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apis"
	"github.com/grafana/grafana/pkg/apis/featureflags/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/utils"
)

var (
	_ rest.Storage              = (*configStorage)(nil)
	_ rest.Scoper               = (*configStorage)(nil)
	_ rest.SingularNameProvider = (*configStorage)(nil)
	_ rest.Lister               = (*configStorage)(nil)
	_ rest.Getter               = (*configStorage)(nil)
)

var startup = metav1.Now()

type configStorage struct {
	features       *featuremgmt.FeatureManager
	namespacer     request.NamespaceMapper
	tableconverter rest.TableConvertor
	resourceInfo   apis.ResourceInfo
}

func (s *configStorage) New() runtime.Object {
	return s.resourceInfo.NewFunc()
}

func (s *configStorage) Destroy() {}

func (s *configStorage) NamespaceScoped() bool {
	return true
}

func (s *configStorage) GetSingularName() string {
	return s.resourceInfo.GetSingularName()
}

func (s *configStorage) NewList() runtime.Object {
	return s.resourceInfo.NewListFunc()
}

func (s *configStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	if s.tableconverter == nil {
		s.tableconverter = utils.NewTableConverter(
			s.resourceInfo.GroupResource(),
			[]metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "Flags", Type: "string", Format: "string", Description: "Where is the flag in the dev cycle"},
			},
			func(obj any) ([]interface{}, error) {
				r, ok := obj.(*v0alpha1.FlagConfig)
				if ok {
					return []interface{}{
						r.Name,
						"???", // TODO map to string?
					}, nil
				}
				return nil, fmt.Errorf("expected resource or info")
			})
	}
	return s.tableconverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *configStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}

	res := &v0alpha1.FlagConfigList{}
	res.Items = append(res.Items, v0alpha1.FlagConfig{
		ObjectMeta: metav1.ObjectMeta{
			Name:              "shared",
			Namespace:         s.namespacer(user.OrgID),
			CreationTimestamp: startup,
		},
		Spec: s.features.GetEnabled(ctx),
	})
	return res, nil
}

func (s *configStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	if name != "shared" {
		return nil, fmt.Errorf("bad name")
	}
	return &v0alpha1.FlagConfig{
		ObjectMeta: metav1.ObjectMeta{
			Name:              "shared",
			CreationTimestamp: startup,
		},
		Spec: s.features.GetEnabled(ctx),
	}, nil
}
