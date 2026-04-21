package correlations

import (
	"encoding/json"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/utils/ptr"

	authlib "github.com/grafana/authlib/types"
	correlationsV0 "github.com/grafana/grafana/apps/correlations/pkg/apis/correlation/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func ToResource(orig Correlation) (*correlationsV0.Correlation, error) {
	cfg, err := ToSpecConfig(orig.Config)
	if err != nil {
		return nil, err
	}
	obj := &correlationsV0.Correlation{
		ObjectMeta: v1.ObjectMeta{
			Name:      orig.UID,
			UID:       types.UID(orig.UID), // required for PATCH to work in legacy storage
			Namespace: authlib.OrgNamespaceFormatter(orig.OrgID),
		},
		Spec: correlationsV0.CorrelationSpec{
			Label: orig.Label,
			Type:  correlationsV0.CorrelationCorrelationType(orig.Type),
			Source: correlationsV0.CorrelationDataSourceRef{
				Group: ptr.Deref(orig.SourceType, ""),
				Name:  orig.SourceUID,
			},
			Config: *cfg,
		},
	}
	if orig.TargetUID != nil {
		obj.Spec.Target = &correlationsV0.CorrelationDataSourceRef{
			Group: ptr.Deref(orig.TargetType, ""),
			Name:  *orig.TargetUID,
		}
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
	return obj, nil
}

func ToCorrelation(obj *correlationsV0.Correlation) (*Correlation, error) {
	ns, err := authlib.ParseNamespace(obj.Namespace)
	if err != nil {
		return nil, err
	}
	cfg, err := ToConfig(obj.Spec.Config)
	if err != nil {
		return nil, err
	}
	result := &Correlation{
		UID:         obj.Name,
		OrgID:       ns.OrgID,
		Label:       obj.Spec.Label,
		Description: ptr.Deref(obj.Spec.Description, ""),
		SourceUID:   obj.Spec.Source.Name,
		SourceType:  ptr.To(obj.Spec.Source.Group),
		Type:        CorrelationType(obj.Spec.Type),
		Config:      *cfg,
	}
	if obj.Annotations[utils.AnnoKeyManagerKind] != "" {
		result.Provisioned = true
	}
	if obj.Spec.Target != nil {
		result.TargetUID = &obj.Spec.Target.Name
		result.TargetType = ptr.To(obj.Spec.Target.Group)
	}
	return result, nil
}

func ToSpecConfig(orig CorrelationConfig) (*correlationsV0.CorrelationConfigSpec, error) {
	out := &correlationsV0.CorrelationConfigSpec{}
	raw, err := json.Marshal(orig)
	if err != nil {
		return nil, err
	}
	err = json.Unmarshal(raw, out)
	if err != nil {
		return nil, err
	}
	if len(out.Target) == 0 {
		out.Target = nil
	}
	return out, err
}

func ToConfig(orig correlationsV0.CorrelationConfigSpec) (*CorrelationConfig, error) {
	out := &CorrelationConfig{}
	raw, err := json.Marshal(orig)
	if err != nil {
		return nil, err
	}
	err = json.Unmarshal(raw, out)
	if err != nil {
		return nil, err
	}
	if len(out.Target) == 0 {
		out.Target = nil
	}
	return out, err
}

func ToUpdateCorrelationCommand(obj *correlationsV0.Correlation) (*UpdateCorrelationCommand, error) {
	tmp, err := ToCorrelation(obj)
	if err != nil {
		return nil, err
	}
	if tmp.Config.Target == nil {
		tmp.Config.Target = map[string]any{} // replace it
	}
	return &UpdateCorrelationCommand{
		UID:         tmp.UID,
		OrgId:       tmp.OrgID,
		SourceUID:   tmp.SourceUID,
		Label:       &tmp.Label,
		Description: &tmp.Description,
		Type:        &tmp.Type,
		Config: &CorrelationConfigUpdateDTO{
			Field:           &tmp.Config.Field,
			Target:          &tmp.Config.Target,
			Transformations: tmp.Config.Transformations,
		},
	}, nil
}

func ToCreateCorrelationCommand(obj *correlationsV0.Correlation) (*CreateCorrelationCommand, error) {
	tmp, err := ToCorrelation(obj)
	if err != nil {
		return nil, err
	}
	return &CreateCorrelationCommand{
		OrgId:       tmp.OrgID,
		SourceUID:   tmp.SourceUID,
		TargetUID:   tmp.TargetUID,
		Label:       tmp.Label,
		Description: tmp.Description,
		Config:      tmp.Config,
		Type:        tmp.Type,
		Provisioned: tmp.Provisioned,
	}, nil
}

func convertUnstructuredToCorrelation(item unstructured.Unstructured) (*Correlation, error) {
	obj := &correlationsV0.Correlation{}
	err := runtime.DefaultUnstructuredConverter.FromUnstructured(item.Object, obj)
	if err != nil {
		return nil, err
	}
	correlation, err := ToCorrelation(obj)
	if err != nil {
		return nil, err
	}
	return correlation, nil
}

func convertCorrelationToUnstructured(item Correlation) (*unstructured.Unstructured, error) {
	corrK8s, err := ToResource(item)
	if err != nil {
		return &unstructured.Unstructured{}, err
	}
	unstructCorr, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&corrK8s)
	if err != nil {
		return nil, err
	}
	return &unstructured.Unstructured{Object: unstructCorr}, nil
}
