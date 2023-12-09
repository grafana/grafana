package alertrules

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apis/alertrules/v0alpha1"
)

var (
	_ rest.Storage              = (*alertRuleStorage)(nil)
	_ rest.Scoper               = (*alertRuleStorage)(nil)
	_ rest.SingularNameProvider = (*alertRuleStorage)(nil)
	_ rest.Lister               = (*alertRuleStorage)(nil)
	_ rest.Getter               = (*alertRuleStorage)(nil)
)

type alertRuleStorage struct {
	store *genericregistry.Store
}

func (s *alertRuleStorage) New() runtime.Object {
	return &v0alpha1.AlertRule{}
}

func (s *alertRuleStorage) Destroy() {}

func (s *alertRuleStorage) NamespaceScoped() bool {
	return true
}

func (s *alertRuleStorage) GetSingularName() string {
	return "alertrule"
}

func (s *alertRuleStorage) NewList() runtime.Object {
	return &v0alpha1.AlertRuleList{}
}

func (s *alertRuleStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.store.TableConvertor.ConvertToTable(ctx, object, tableOptions)
}

func (s *alertRuleStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	rules := &v0alpha1.AlertRuleList{}

	for i := 0; i < 5; i++ {
		rule := v0alpha1.AlertRule{
			ObjectMeta: metav1.ObjectMeta{
				Name: fmt.Sprintf("rule-%d", i),
			},
			Spec: v0alpha1.Spec{
				Description: "TODO",
			},
		}
		rules.Items = append(rules.Items, rule)
	}

	return rules, nil
}

func (s *alertRuleStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {

	rule := &v0alpha1.AlertRule{
		ObjectMeta: metav1.ObjectMeta{
			Name: name,
		},
		Spec: v0alpha1.Spec{
			Description: "TODO",
		},
	}

	return rule, nil
}
