package conversion

import (
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2alpha2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha2"
)

func RegisterConversions(s *runtime.Scheme) error {
	// v0 conversions
	if err := s.AddConversionFunc((*dashv0.Dashboard)(nil), (*dashv1.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V0_to_V1(a.(*dashv0.Dashboard), b.(*dashv1.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv0.Dashboard)(nil), (*dashv2alpha1.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V0_to_V2alpha1(a.(*dashv0.Dashboard), b.(*dashv2alpha1.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv0.Dashboard)(nil), (*dashv2alpha2.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V0_to_V2alpha2(a.(*dashv0.Dashboard), b.(*dashv2alpha2.Dashboard), scope)
	}); err != nil {
		return err
	}

	// v1 conversions
	if err := s.AddConversionFunc((*dashv1.Dashboard)(nil), (*dashv0.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V1_to_V0(a.(*dashv1.Dashboard), b.(*dashv0.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv1.Dashboard)(nil), (*dashv2alpha1.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V1_to_V2alpha1(a.(*dashv1.Dashboard), b.(*dashv2alpha1.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv1.Dashboard)(nil), (*dashv2alpha2.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V1_to_V2alpha2(a.(*dashv1.Dashboard), b.(*dashv2alpha2.Dashboard), scope)
	}); err != nil {
		return err
	}

	// v2alpha1 conversions
	if err := s.AddConversionFunc((*dashv2alpha1.Dashboard)(nil), (*dashv0.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V2alpha1_to_V0(a.(*dashv2alpha1.Dashboard), b.(*dashv0.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv2alpha1.Dashboard)(nil), (*dashv1.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V2alpha1_to_V1(a.(*dashv2alpha1.Dashboard), b.(*dashv1.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv2alpha1.Dashboard)(nil), (*dashv2alpha2.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V2alpha1_to_V2alpha2(a.(*dashv2alpha1.Dashboard), b.(*dashv2alpha2.Dashboard), scope)
	}); err != nil {
		return err
	}

	// v2alpha2 conversions
	if err := s.AddConversionFunc((*dashv2alpha2.Dashboard)(nil), (*dashv0.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V2alpha2_to_V0(a.(*dashv2alpha2.Dashboard), b.(*dashv0.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv2alpha2.Dashboard)(nil), (*dashv1.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V2alpha2_to_V1(a.(*dashv2alpha2.Dashboard), b.(*dashv1.Dashboard), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv2alpha2.Dashboard)(nil), (*dashv2alpha1.Dashboard)(nil), func(a, b interface{}, scope conversion.Scope) error {
		return Convert_V2alpha2_to_V2alpha1(a.(*dashv2alpha2.Dashboard), b.(*dashv2alpha1.Dashboard), scope)
	}); err != nil {
		return err
	}

	return nil
}
