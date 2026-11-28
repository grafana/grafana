package dashboard

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

type dashboardUpdateStrategy struct {
	rest.RESTUpdateStrategy
}

func (s dashboardUpdateStrategy) PrepareForUpdate(ctx context.Context, obj, old runtime.Object) {
	s.RESTUpdateStrategy.PrepareForUpdate(ctx, obj, old)
	clearConversionStatus(obj)
}

func clearConversionStatus(obj runtime.Object) {
	switch d := obj.(type) {
	case *dashv0.Dashboard:
		d.Status.Conversion = nil
	case *dashv1.Dashboard:
		d.Status.Conversion = nil
	case *dashv2alpha1.Dashboard:
		d.Status.Conversion = nil
	case *dashv2beta1.Dashboard:
		d.Status.Conversion = nil
	case *dashv2.Dashboard:
		d.Status.Conversion = nil
	}
}
