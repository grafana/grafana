package conversion

import (
	"errors"
	"fmt"

	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana-app-sdk/logging"
	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

var logger = logging.DefaultLogger.With("logger", "dashboard.conversion")

// withConversionMetrics wraps a conversion function with metrics and logging for the overall conversion process
func withConversionMetrics(sourceVersionAPI, targetVersionAPI string, conversionFunc func(a, b interface{}, scope conversion.Scope) error) func(a, b interface{}, scope conversion.Scope) error {
	return func(a, b interface{}, scope conversion.Scope) error {
		// Extract dashboard UID and schema version from source
		var dashboardUID string
		var sourceSchemaVersion interface{} = "unknown"
		var targetSchemaVersion interface{} = "unknown"

		// Try to extract UID and schema version from source dashboard
		switch source := a.(type) {
		case *dashv0.Dashboard:
			dashboardUID = string(source.UID)
			if source.Spec.Object != nil {
				sourceSchemaVersion = source.Spec.Object["schemaVersion"]
			}
		case *dashv1.Dashboard:
			dashboardUID = string(source.UID)
			if source.Spec.Object != nil {
				sourceSchemaVersion = source.Spec.Object["schemaVersion"]
			}
		case *dashv2alpha1.Dashboard:
			dashboardUID = string(source.UID)
			sourceSchemaVersion = "v2alpha1" // V2 doesn't use numeric schema versions
		case *dashv2beta1.Dashboard:
			dashboardUID = string(source.UID)
			sourceSchemaVersion = "v2beta1" // V2 doesn't use numeric schema versions
		}

		// Determine target schema version based on target type
		switch b.(type) {
		case *dashv0.Dashboard:
			targetSchemaVersion = sourceSchemaVersion // V0 keeps source schema version
		case *dashv1.Dashboard:
			targetSchemaVersion = schemaversion.LATEST_VERSION // V1 migrates to latest
		case *dashv2alpha1.Dashboard:
			targetSchemaVersion = "v2alpha1"
		case *dashv2beta1.Dashboard:
			targetSchemaVersion = "v2beta1"
		}

		// Execute the actual conversion
		err := conversionFunc(a, b, scope)

		// Report conversion-level metrics and logs
		if err != nil {
			// Classify error type for metrics
			errorType := "conversion_error"
			var migrationErr *schemaversion.MigrationError
			var minVersionErr *schemaversion.MinimumVersionError
			if errors.As(err, &migrationErr) {
				errorType = "schema_version_migration_error"
			} else if errors.As(err, &minVersionErr) {
				errorType = "schema_minimum_version_error"
			}

			// Record failure metrics
			migration.MDashboardConversionFailureTotal.WithLabelValues(
				sourceVersionAPI,
				targetVersionAPI,
				fmt.Sprintf("%v", sourceSchemaVersion),
				fmt.Sprintf("%v", targetSchemaVersion),
				errorType,
			).Inc()

			// Log failure
			logger.Error("Dashboard conversion failed",
				"sourceVersionAPI", sourceVersionAPI,
				"targetVersionAPI", targetVersionAPI,
				"dashboardUID", dashboardUID,
				"sourceSchemaVersion", sourceSchemaVersion,
				"targetSchemaVersion", targetSchemaVersion,
				"errorType", errorType,
				"error", err)
		} else {
			// Record success metrics
			migration.MDashboardConversionSuccessTotal.WithLabelValues(
				sourceVersionAPI,
				targetVersionAPI,
				fmt.Sprintf("%v", sourceSchemaVersion),
				fmt.Sprintf("%v", targetSchemaVersion),
			).Inc()

			// Log success (debug level to avoid spam)
			logger.Debug("Dashboard conversion succeeded",
				"sourceVersionAPI", sourceVersionAPI,
				"targetVersionAPI", targetVersionAPI,
				"dashboardUID", dashboardUID,
				"sourceSchemaVersion", sourceSchemaVersion,
				"targetSchemaVersion", targetSchemaVersion)
		}

		return err
	}
}

func RegisterConversions(s *runtime.Scheme) error {
	// v0 conversions
	if err := s.AddConversionFunc((*dashv0.Dashboard)(nil), (*dashv1.Dashboard)(nil),
		withConversionMetrics(dashv0.APIVERSION, dashv1.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V0_to_V1(a.(*dashv0.Dashboard), b.(*dashv1.Dashboard), scope)
		})); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv0.Dashboard)(nil), (*dashv2alpha1.Dashboard)(nil),
		withConversionMetrics(dashv0.APIVERSION, dashv2alpha1.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V0_to_V2alpha1(a.(*dashv0.Dashboard), b.(*dashv2alpha1.Dashboard), scope)
		})); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv0.Dashboard)(nil), (*dashv2beta1.Dashboard)(nil),
		withConversionMetrics(dashv0.APIVERSION, dashv2beta1.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V0_to_V2beta1(a.(*dashv0.Dashboard), b.(*dashv2beta1.Dashboard), scope)
		})); err != nil {
		return err
	}

	// v1 conversions
	if err := s.AddConversionFunc((*dashv1.Dashboard)(nil), (*dashv0.Dashboard)(nil),
		withConversionMetrics(dashv1.APIVERSION, dashv0.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V1_to_V0(a.(*dashv1.Dashboard), b.(*dashv0.Dashboard), scope)
		})); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv1.Dashboard)(nil), (*dashv2alpha1.Dashboard)(nil),
		withConversionMetrics(dashv1.APIVERSION, dashv2alpha1.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V1_to_V2alpha1(a.(*dashv1.Dashboard), b.(*dashv2alpha1.Dashboard), scope)
		})); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv1.Dashboard)(nil), (*dashv2beta1.Dashboard)(nil),
		withConversionMetrics(dashv1.APIVERSION, dashv2beta1.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V1_to_V2beta1(a.(*dashv1.Dashboard), b.(*dashv2beta1.Dashboard), scope)
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
			return Convert_V2alpha1_to_V1(a.(*dashv2alpha1.Dashboard), b.(*dashv1.Dashboard), scope)
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
			return Convert_V2beta1_to_V0(a.(*dashv2beta1.Dashboard), b.(*dashv0.Dashboard), scope)
		})); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*dashv2beta1.Dashboard)(nil), (*dashv1.Dashboard)(nil),
		withConversionMetrics(dashv2beta1.APIVERSION, dashv1.APIVERSION, func(a, b interface{}, scope conversion.Scope) error {
			return Convert_V2beta1_to_V1(a.(*dashv2beta1.Dashboard), b.(*dashv1.Dashboard), scope)
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
