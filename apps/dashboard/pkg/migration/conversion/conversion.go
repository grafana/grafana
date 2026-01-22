package conversion

import (
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/ptr"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

// DashboardConversion provides methods for managing conversion status on dashboard objects.
type DashboardConversion interface {
	// returns the stored version from status.conversion.storedVersion,
	// or empty string if not set.
	GetStoredVersion() string
	// returns the API version of this dashboard (e.g., "v2beta1").
	GetAPIVersion() string
	// sets the conversion status on the dashboard.
	SetConversionStatus(storedVersion string, failed bool, errMsg *string, source interface{})
}

func getStoredVersion(in DashboardConversion) string {
	if sv := in.GetStoredVersion(); sv != "" {
		return sv
	}
	return in.GetAPIVersion()
}

func setConversionStatus(in DashboardConversion, out DashboardConversion, err error, source interface{}) {
	storedVersion := getStoredVersion(in)
	var errMsg *string
	if err != nil {
		errMsg = ptr.To(err.Error())
	}
	out.SetConversionStatus(storedVersion, err != nil, errMsg, source)
}

func RegisterConversions(s *runtime.Scheme, dsIndexProvider schemaversion.DataSourceIndexProvider, leIndexProvider schemaversion.LibraryElementIndexProvider) error {
	// v0 conversions
	if err := s.AddConversionFunc((*dashv0.Dashboard)(nil), (*dashv1.Dashboard)(nil),
		withConversionMetrics(dashv0.APIVERSION, dashv1.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V0_to_V1beta1(a.(*dashv0.Dashboard), b.(*dashv1.Dashboard), scope)
		})); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv0.Dashboard)(nil), (*dashv2alpha1.Dashboard)(nil),
		withConversionMetrics(dashv0.APIVERSION, dashv2alpha1.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V0_to_V2alpha1(a.(*dashv0.Dashboard), b.(*dashv2alpha1.Dashboard), scope, dsIndexProvider, leIndexProvider)
		})); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv0.Dashboard)(nil), (*dashv2beta1.Dashboard)(nil),
		withConversionMetrics(dashv0.APIVERSION, dashv2beta1.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V0_to_V2beta1(a.(*dashv0.Dashboard), b.(*dashv2beta1.Dashboard), scope, dsIndexProvider, leIndexProvider)
		})); err != nil {
		return err
	}

	// v1 conversions
	if err := s.AddConversionFunc((*dashv1.Dashboard)(nil), (*dashv0.Dashboard)(nil),
		withConversionMetrics(dashv1.APIVERSION, dashv0.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V1beta1_to_V0(a.(*dashv1.Dashboard), b.(*dashv0.Dashboard), scope)
		})); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv1.Dashboard)(nil), (*dashv2alpha1.Dashboard)(nil),
		withConversionMetrics(dashv1.APIVERSION, dashv2alpha1.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V1beta1_to_V2alpha1(a.(*dashv1.Dashboard), b.(*dashv2alpha1.Dashboard), scope, dsIndexProvider, leIndexProvider)
		})); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv1.Dashboard)(nil), (*dashv2beta1.Dashboard)(nil),
		withConversionMetrics(dashv1.APIVERSION, dashv2beta1.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V1beta1_to_V2beta1(a.(*dashv1.Dashboard), b.(*dashv2beta1.Dashboard), scope, dsIndexProvider, leIndexProvider)
		})); err != nil {
		return err
	}

	// v2alpha1 conversions
	if err := s.AddConversionFunc((*dashv2alpha1.Dashboard)(nil), (*dashv0.Dashboard)(nil),
		withConversionMetrics(dashv2alpha1.APIVERSION, dashv0.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V2alpha1_to_V0(a.(*dashv2alpha1.Dashboard), b.(*dashv0.Dashboard), scope)
		})); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv2alpha1.Dashboard)(nil), (*dashv1.Dashboard)(nil),
		withConversionMetrics(dashv2alpha1.APIVERSION, dashv1.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V2alpha1_to_V1beta1(a.(*dashv2alpha1.Dashboard), b.(*dashv1.Dashboard), scope)
		})); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv2alpha1.Dashboard)(nil), (*dashv2beta1.Dashboard)(nil),
		withConversionMetrics(dashv2alpha1.APIVERSION, dashv2beta1.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V2alpha1_to_V2beta1(a.(*dashv2alpha1.Dashboard), b.(*dashv2beta1.Dashboard), scope)
		})); err != nil {
		return err
	}

	// v2beta1 conversions
	if err := s.AddConversionFunc((*dashv2beta1.Dashboard)(nil), (*dashv0.Dashboard)(nil),
		withConversionMetrics(dashv2beta1.APIVERSION, dashv0.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V2beta1_to_V0(a.(*dashv2beta1.Dashboard), b.(*dashv0.Dashboard), scope, dsIndexProvider)
		})); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv2beta1.Dashboard)(nil), (*dashv1.Dashboard)(nil),
		withConversionMetrics(dashv2beta1.APIVERSION, dashv1.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V2beta1_to_V1beta1(a.(*dashv2beta1.Dashboard), b.(*dashv1.Dashboard), scope, dsIndexProvider)
		})); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv2beta1.Dashboard)(nil), (*dashv2alpha1.Dashboard)(nil),
		withConversionMetrics(dashv2beta1.APIVERSION, dashv2alpha1.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V2beta1_to_V2alpha1(a.(*dashv2beta1.Dashboard), b.(*dashv2alpha1.Dashboard), scope)
		})); err != nil {
		return err
	}

	return nil
}
