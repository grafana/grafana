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
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/kinds"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	alerting_models "github.com/grafana/grafana/pkg/services/ngalert/models"
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
	b     *AlertRulesAPIBuilder
}

func (s *alertRuleStorage) New() runtime.Object {
	return resourceInfo.NewFunc()
}

func (s *alertRuleStorage) Destroy() {}

func (s *alertRuleStorage) NamespaceScoped() bool {
	return true
}

func (s *alertRuleStorage) GetSingularName() string {
	return resourceInfo.GetSingularName()
}

func (s *alertRuleStorage) NewList() runtime.Object {
	return resourceInfo.NewListFunc()
}

func (s *alertRuleStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.store.TableConvertor.ConvertToTable(ctx, object, tableOptions)
}

func (s *alertRuleStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	orgID, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}

	rules, prov, err := s.b.ruleService.GetAlertRules(ctx, orgID)
	if err != nil {
		return nil, err
	}

	list := &v0alpha1.AlertRuleList{}
	for _, rule := range rules {
		namespace := s.b.namespacer(rule.OrgID)
		r, err := toRuleResource(namespace, rule, prov[""])
		if err != nil {
			return nil, err
		}
		list.Items = append(list.Items, *r)
	}
	return list, nil
}

func (s *alertRuleStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	rule, prov, err := s.b.ruleService.GetAlertRule(ctx, info.OrgID, name)
	if err != nil {
		return nil, err
	}

	return toRuleResource(s.b.namespacer(rule.OrgID), &rule, prov)
}

// Convert rule model to the resource equivalent
// TODO!!! defining this is the real work :)  and a query model that feels OK
func toRuleResource(namespace string, rule *alerting_models.AlertRule, prov alerting_models.Provenance) (*v0alpha1.AlertRule, error) {
	obj := &v0alpha1.AlertRule{
		TypeMeta: resourceInfo.TypeMeta(),
		ObjectMeta: metav1.ObjectMeta{
			Name:            rule.UID,
			Namespace:       namespace,
			ResourceVersion: fmt.Sprintf("%d", rule.Updated.UnixMilli()),
			Labels:          rule.Labels,
		},
		Spec: v0alpha1.Spec{
			Title:        rule.Title,
			Condition:    rule.Condition,
			Paused:       rule.IsPaused,
			NoDataState:  v0alpha1.AlertingState(rule.NoDataState),
			ExecErrState: v0alpha1.AlertingState(rule.ExecErrState),
			Annotations:  rule.Annotations,
		},
	}

	// HACK!! define this better!!!
	for _, target := range rule.Data {
		q, err := simplejson.NewJson(target.Model)
		if err != nil {
			return nil, err
		}

		s, err := q.Get("refId").String()
		if err != nil || s != target.RefID {
			q.Set("refId", target.RefID)
		}

		// s, err := q.Get("datasource").Map()
		// if err != nil || s != target.RefID {
		// 	q.Set("refId", target.RefID)
		// }

		obj.Spec.Query = append(obj.Spec.Query, *q)
	}

	accessor := kinds.MetaAccessor(obj)
	accessor.SetUpdatedTimestamp(&rule.Updated)
	accessor.SetFolder(rule.NamespaceUID)

	p := string(prov)
	if p != "" {
		accessor.SetOriginInfo(&kinds.ResourceOriginInfo{
			Name: p,
		})
	}

	return obj, nil
}
