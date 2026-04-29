package app

import (
	"context"
	"fmt"
	"strconv"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"k8s.io/apimachinery/pkg/runtime/schema"

	correlationsv0alpha1 "github.com/grafana/grafana/apps/correlations/pkg/apis/correlation/v0alpha1"
)

func New(cfg app.Config) (app.App, error) {
	simpleConfig := simple.AppConfig{
		Name:       "correlation",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			InformerOptions: operator.InformerOptions{
				ErrorHandler: func(ctx context.Context, err error) {
					logging.FromContext(ctx).Error("Informer processing error", "error", err)
				},
			},
		},
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind:    correlationsv0alpha1.CorrelationKind(),
				Mutator: DataSourceMutator(),
			},
		},
	}

	a, err := simple.NewApp(simpleConfig)
	if err != nil {
		return nil, err
	}

	err = a.ValidateManifest(cfg.ManifestData)
	if err != nil {
		return nil, err
	}

	return a, nil
}

func GetKinds() map[schema.GroupVersion][]resource.Kind {
	gv := schema.GroupVersion{
		Group:   correlationsv0alpha1.CorrelationKind().Group(),
		Version: correlationsv0alpha1.CorrelationKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {correlationsv0alpha1.CorrelationKind()},
	}
}

const (
	// SourceRefLabelKey is the label key for the composite source reference (group.name)
	// without provisioning is used for filtering when we don't care about if the correlation was provisioned (ie, showing all correlations for the selected datasource(s) in explore)
	// with provisioning is when we do (ie: deleting all previously provisioned correlations by datasource)
	SourceRefLabelKey     = "correlations.grafana.app/sourceDS-ref"
	SourceRefProvLabelKey = "correlations.grafana.app/sourceDSProv-ref"

	// TargetRefLabelKey is the label key for the composite target reference (group.name)
	TargetRefLabelKey = "correlations.grafana.app/targetDS-ref"
)

func DataSourceMutator() *simple.Mutator {
	return &simple.Mutator{
		MutateFunc: func(ctx context.Context, req *app.AdmissionRequest) (*app.MutatingResponse, error) {
			c, ok := req.Object.(*correlationsv0alpha1.Correlation)
			if !ok || c == nil {
				return nil, nil
			}

			if c.Labels == nil {
				c.Labels = make(map[string]string)
			}

			managedBy := c.ObjectMeta.Annotations["grafana.app/managedBy"]
			isManaged := managedBy != ""

			// Derive source label: "group.name" format
			c.Labels[SourceRefLabelKey] = fmt.Sprintf("%s.%s",
				c.Spec.Source.Group,
				c.Spec.Source.Name)

			c.Labels[SourceRefProvLabelKey] = fmt.Sprintf("%s.%s.%s",
				c.Spec.Source.Group,
				c.Spec.Source.Name, strconv.FormatBool(isManaged))

			// Derive target label if target is present
			if c.Spec.Target != nil {
				c.Labels[TargetRefLabelKey] = fmt.Sprintf("%s.%s",
					c.Spec.Target.Group,
					c.Spec.Target.Name)
			}

			return &app.MutatingResponse{UpdatedObject: c}, nil
		},
	}
}
