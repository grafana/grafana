package configmap

import (
	"context"

	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// Validate validates ConfigMap repository configuration.
func Validate(_ context.Context, obj runtime.Object) field.ErrorList {
	repo, ok := obj.(*provisioning.Repository)
	if !ok {
		return nil
	}
	if repo.Spec.Type != provisioning.ConfigMapRepositoryType {
		return nil
	}

	cfg := repo.Spec.ConfigMap
	if cfg == nil {
		return field.ErrorList{
			field.Required(field.NewPath("spec", "configmap"), "configmap configuration is required for configmap repository type"),
		}
	}

	var list field.ErrorList
	base := field.NewPath("spec", "configmap")
	hasName := cfg.Name != ""
	hasSelector := cfg.LabelSelector != ""
	if !hasName && !hasSelector {
		list = append(list, field.Required(base, "must set name or labelSelector"))
	}
	if hasName && hasSelector {
		list = append(list, field.Invalid(base, cfg, "name and labelSelector are mutually exclusive"))
	}
	if hasSelector {
		if _, err := labels.Parse(cfg.LabelSelector); err != nil {
			list = append(list, field.Invalid(base.Child("labelSelector"), cfg.LabelSelector, err.Error()))
		}
	}
	return list
}
