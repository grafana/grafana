package conversion

import (
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"

	dashboard "github.com/grafana/grafana/pkg/apis/dashboard"
	dashboardV0 "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/pkg/apis/dashboard/v1alpha1"
	dashboardV2 "github.com/grafana/grafana/pkg/apis/dashboard/v2alpha1"
)

func RegisterConversions(s *runtime.Scheme) error {
	if err := s.AddConversionFunc((*dashboard.Dashboard)(nil), (*dashboardV0.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_to_V0(a.(*dashboard.Dashboard), b.(*dashboardV0.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashboard.Dashboard)(nil), (*dashboardV1.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_to_V1(a.(*dashboard.Dashboard), b.(*dashboardV1.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashboard.Dashboard)(nil), (*dashboardV2.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_to_V2(a.(*dashboard.Dashboard), b.(*dashboardV2.Dashboard), scope)
	}); err != nil {
		return err
	}

	// The following do not seem to get called????

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
	if err := s.AddConversionFunc((*dashboardV2.Dashboard)(nil), (*dashboardV1.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V2_to_V1(a.(*dashboardV2.Dashboard), b.(*dashboardV1.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashboardV2.Dashboard)(nil), (*dashboardV0.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V2_to_V0(a.(*dashboardV2.Dashboard), b.(*dashboardV0.Dashboard), scope)
	}); err != nil {
		return err
	}
	return nil
}

func Convert_to_V0(in *dashboard.Dashboard, out *dashboardV0.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	anno := out.Annotations
	if anno == nil {
		anno = make(map[string]string)
		out.Annotations = anno
	}
	anno["xxxx"] = "Convert_to_V0"

	return nil
}

func Convert_to_V1(in *dashboard.Dashboard, out *dashboardV1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	anno := out.Annotations
	if anno == nil {
		anno = make(map[string]string)
		out.Annotations = anno
	}
	anno["xxxx"] = "Convert_to_V1"

	return nil
}

func Convert_to_V2(in *dashboard.Dashboard, out *dashboardV2.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	anno := out.Annotations
	if anno == nil {
		anno = make(map[string]string)
		out.Annotations = anno
	}
	anno["xxxx"] = "Convert_to_V2"

	return nil
}

func Convert_V0_to_V1(in *dashboardV0.Dashboard, out *dashboardV1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	anno := out.Annotations
	if anno == nil {
		anno = make(map[string]string)
		out.Annotations = anno
	}
	anno["xxxx"] = "Convert_V0_to_V1"

	return nil
}

func Convert_V0_to_V2(in *dashboardV0.Dashboard, out *dashboardV2.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	anno := out.Annotations
	if anno == nil {
		anno = make(map[string]string)
		out.Annotations = anno
	}
	anno["xxxx"] = "Convert_V0_to_V2"

	return nil
}

func Convert_V1_to_V0(in *dashboardV1.Dashboard, out *dashboardV0.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	anno := out.Annotations
	if anno == nil {
		anno = make(map[string]string)
		out.Annotations = anno
	}
	anno["xxxx"] = "Convert_V1_to_V0"

	return nil
}

func Convert_V1_to_V2(in *dashboardV1.Dashboard, out *dashboardV2.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	anno := out.Annotations
	if anno == nil {
		anno = make(map[string]string)
		out.Annotations = anno
	}
	anno["xxxx"] = "Convert_V1_to_V2"

	return nil
}

func Convert_V2_to_V1(in *dashboardV2.Dashboard, out *dashboardV1.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	anno := out.Annotations
	if anno == nil {
		anno = make(map[string]string)
		out.Annotations = anno
	}
	anno["xxxx"] = "Convert_V2_to_V1"

	return nil
}

func Convert_V2_to_V0(in *dashboardV2.Dashboard, out *dashboardV0.Dashboard, scope conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta

	anno := out.Annotations
	if anno == nil {
		anno = make(map[string]string)
		out.Annotations = anno
	}
	anno["xxxx"] = "Convert_V2_to_V0"

	return nil
}
