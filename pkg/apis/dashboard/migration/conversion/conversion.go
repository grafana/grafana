package conversion

import (
	"fmt"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"

	dashboardV0 "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/pkg/apis/dashboard/v1alpha1"
	dashboardV2 "github.com/grafana/grafana/pkg/apis/dashboard/v2alpha1"
)

func RegisterConversions(s *runtime.Scheme) error {
	if err := s.AddConversionFunc((*dashboardV0.Dashboard)(nil), (*dashboardV1.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V0_to_V1(a.(*dashboardV0.Dashboard), b.(*dashboardV1.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashboardV0.Dashboard)(nil), (*dashboardV2.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V0_to_V2(a.(*dashboardV0.Dashboard), b.(*dashboardV2.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashboardV1.Dashboard)(nil), (*dashboardV0.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V1_to_V0(a.(*dashboardV1.Dashboard), b.(*dashboardV0.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashboardV1.Dashboard)(nil), (*dashboardV2.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V1_to_V2(a.(*dashboardV1.Dashboard), b.(*dashboardV2.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashboardV2.Dashboard)(nil), (*dashboardV0.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V2_to_V0(a.(*dashboardV2.Dashboard), b.(*dashboardV0.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashboardV2.Dashboard)(nil), (*dashboardV1.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V2_to_V1(a.(*dashboardV2.Dashboard), b.(*dashboardV1.Dashboard), scope)
	}); err != nil {
		return err
	}
	return nil
}

func Convert_V0_to_V1(in *dashboardV0.Dashboard, out *dashboardV1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.Spec = in.Spec
	setConversionAnno(&out.ObjectMeta, "V0_to_V1")
	return nil
}

func Convert_V0_to_V2(in *dashboardV0.Dashboard, out *dashboardV2.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.Spec = in.Spec
	setConversionAnno(&out.ObjectMeta, "V0_to_V2")
	return nil
}

func Convert_V1_to_V0(in *dashboardV1.Dashboard, out *dashboardV0.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.Spec = in.Spec
	setConversionAnno(&out.ObjectMeta, "V1_to_V0")
	return nil
}

func Convert_V1_to_V2(in *dashboardV1.Dashboard, out *dashboardV2.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.Spec = in.Spec
	setConversionAnno(&out.ObjectMeta, "V1_to_V2")
	return nil
}

func Convert_V2_to_V0(in *dashboardV2.Dashboard, out *dashboardV0.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.Spec = in.Spec
	setConversionAnno(&out.ObjectMeta, "V2_to_V0")
	return nil
}

func Convert_V2_to_V1(in *dashboardV2.Dashboard, out *dashboardV1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.Spec = in.Spec
	setConversionAnno(&out.ObjectMeta, "V2_to_V1")
	return nil
}

// Add an annotation tracking which conversions have been run
func setConversionAnno(meta *v1.ObjectMeta, val string) {
	anno := meta.Annotations
	if anno == nil {
		anno = make(map[string]string)
		meta.Annotations = anno
	}

	for i := range 10 {
		key := fmt.Sprintf("CONVERSION-%d", i)
		if anno[key] != "" {
			continue
		}
		anno[key] = val
		return
	}
}
