package dashboard

import (
	"encoding/json"
	"errors"
	"fmt"
	"sync"

	"github.com/getkin/kin-openapi/openapi3"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"

	manifestdata "github.com/grafana/grafana/apps/dashboard/pkg/apis"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

// Built on first use instead of at init, so a schema that can't be built fails writes closed instead of
// crashing server startup.
var dashboardPreferencesSpecSchema = sync.OnceValues(buildDashboardPreferencesSpecSchema)

func buildDashboardPreferencesSpecSchema() (*openapi3.Schema, error) {
	gvk := dashv2beta1.DashboardPreferencesResourceInfo.GroupVersionKind()

	for _, version := range manifestdata.LocalManifest().ManifestData.Versions {
		if version.Name != gvk.Version {
			continue
		}
		for _, kind := range version.Kinds {
			if kind.Kind != gvk.Kind {
				continue
			}

			crd, err := kind.Schema.AsCRDOpenAPI3(gvk.Kind)
			if err != nil {
				return nil, fmt.Errorf("error resolving the schema of %s: %w", gvk, err)
			}
			specRef := crd.Properties["spec"]
			if specRef == nil || specRef.Value == nil {
				return nil, fmt.Errorf("the schema of %s has no spec property", gvk)
			}
			return specRef.Value, nil
		}
	}

	return nil, fmt.Errorf("the dashboard manifest has no schema for %s", gvk)
}

func validateDashboardPreferencesSpec(name string, spec dashv2beta1.DashboardPreferencesSpec) error {
	specSchema, err := dashboardPreferencesSpecSchema()
	if err != nil {
		return err
	}

	raw, err := json.Marshal(spec)
	if err != nil {
		return fmt.Errorf("error marshaling dashboard preferences spec: %w", err)
	}
	var decoded any
	if err = json.Unmarshal(raw, &decoded); err != nil {
		return fmt.Errorf("error decoding dashboard preferences spec: %w", err)
	}

	// Unknown keys are not violations: the typed spec has already dropped them, and AsCRDOpenAPI3 removes
	// additionalProperties: false from the schema.
	verr := specSchema.VisitJSON(decoded, openapi3.MultiErrors())
	if verr == nil {
		return nil
	}

	violations, ok := errors.AsType[openapi3.MultiError](verr)
	if !ok {
		violations = openapi3.MultiError{verr}
	}
	errs := make(field.ErrorList, 0, len(violations))
	// A value below an exclusive minimum also fails the minimum it is written with, and that later cause
	// misstates the bound, so each field keeps only its first cause.
	seen := make(map[string]bool, len(violations))
	for _, violation := range violations {
		fieldErr := dashboardPreferencesSchemaErrorToField(violation)
		if seen[fieldErr.Field] {
			continue
		}
		seen[fieldErr.Field] = true
		errs = append(errs, fieldErr)
	}
	return apierrors.NewInvalid(dashv2beta1.DashboardPreferencesResourceInfo.GroupVersionKind().GroupKind(), name, errs)
}

func dashboardPreferencesSchemaErrorToField(err error) *field.Error {
	se, ok := errors.AsType[*openapi3.SchemaError](err)
	if !ok {
		return field.Invalid(field.NewPath("spec"), nil, err.Error())
	}
	return field.Invalid(field.NewPath("spec", se.JSONPointer()...), se.Value, se.Reason)
}
