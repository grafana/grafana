package correlations

import (
	"fmt"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"

	authlib "github.com/grafana/authlib/types"
	correlationsV0 "github.com/grafana/grafana/apps/correlations/pkg/apis/correlation/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type DatasourceGroupLookup = func(uid string) string

func ToResource(orig Correlation, namespacer authlib.NamespaceFormatter, lookup DatasourceGroupLookup) *correlationsV0.Correlation {
	obj := &correlationsV0.Correlation{
		ObjectMeta: v1.ObjectMeta{
			Name:      orig.UID,
			Namespace: namespacer(orig.OrgID),
		},
		Spec: correlationsV0.CorrelationSpec{
			Label: orig.Label,
			Type:  correlationsV0.CorrelationCorrelationType(orig.Type),
			Datasource: correlationsV0.CorrelationDataSourceRef{
				Group: lookup(orig.SourceUID),
				Name:  orig.SourceUID,
			},
			Config: ToSpecConfig(orig.Config),
		},
	}
	if orig.TargetUID != nil {
		obj.Spec.Target = []correlationsV0.CorrelationDataSourceRef{{
			Group: lookup(*orig.TargetUID),
			Name:  *orig.TargetUID,
		}}
	}
	if orig.Description != "" {
		obj.Spec.Description = &orig.Description
	}
	if orig.Provisioned {
		tmp, _ := utils.MetaAccessor(obj)
		tmp.SetManagerProperties(utils.ManagerProperties{
			Kind: utils.ManagerKindClassicFP, // nolint:staticcheck
		})
	}
	return obj
}

func ToCorrelation(obj *correlationsV0.Correlation) (*Correlation, error) {
	ns, err := authlib.ParseNamespace(obj.Namespace)
	if err != nil {
		return nil, err
	}
	result := &Correlation{
		UID:         obj.Name,
		OrgID:       ns.OrgID,
		Label:       obj.Spec.Label,
		Description: ptr.Deref(obj.Spec.Description, ""),
		SourceUID:   obj.Spec.Datasource.Name,
		Type:        CorrelationType(obj.Spec.Type),
		Config:      ToConfig(obj.Spec.Config),
	}
	if obj.Annotations[utils.AnnoKeyManagerKind] != "" {
		result.Provisioned = true
	}
	if len(obj.Spec.Target) > 1 {
		return nil, fmt.Errorf("unable to support multiple targets")
	}
	if len(obj.Spec.Target) == 1 {
		result.TargetUID = &obj.Spec.Target[0].Name
	}
	return result, nil
}

func ToSpecConfig(orig CorrelationConfig) correlationsV0.CorrelationConfigSpec {
	return correlationsV0.CorrelationConfigSpec{
		Field: orig.Field,
		// TODO... the rest
	}
}

func ToConfig(orig correlationsV0.CorrelationConfigSpec) CorrelationConfig {
	return CorrelationConfig{
		Field: orig.Field,
		// TODO... the rest
	}
}
