package dashboard

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
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

// validateDashboardPreferencesSpec returns one 422 for the schema's violations, the reset rules and valueErrs,
// which hold the checks the schema can't express, so a caller sees every problem at once.
func validateDashboardPreferencesSpec(name string, spec dashv2beta1.DashboardPreferencesSpec, valueErrs ...*field.Error) error {
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

	var errs field.ErrorList
	// A value below an exclusive minimum also fails the minimum it is written with, and that later cause
	// misstates the bound, so each field keeps only its first cause. The schema's causes come first, so a
	// value check doesn't restate a field the schema already rejected.
	seen := make(map[string]bool)
	add := func(fieldErr *field.Error) {
		if !seen[fieldErr.Field] {
			seen[fieldErr.Field] = true
			errs = append(errs, fieldErr)
		}
	}

	// Unknown keys are not violations: the typed spec has already dropped them, and AsCRDOpenAPI3 removes
	// additionalProperties: false from the schema.
	if verr := specSchema.VisitJSON(decoded, openapi3.MultiErrors()); verr != nil {
		violations, ok := errors.AsType[openapi3.MultiError](verr)
		if !ok {
			violations = openapi3.MultiError{verr}
		}
		for _, violation := range violations {
			add(dashboardPreferencesSchemaErrorToField(violation))
		}
	}
	for _, fieldErr := range dashboardPreferencesResetErrors(spec.Reset, decoded) {
		add(fieldErr)
	}
	for _, fieldErr := range valueErrs {
		add(fieldErr)
	}

	if len(errs) == 0 {
		return nil
	}
	return apierrors.NewInvalid(dashv2beta1.DashboardPreferencesResourceInfo.GroupVersionKind().GroupKind(), name, errs)
}

// The schema can't state either rule: codegen drops list.UniqueItems(), and a field that is both set and
// reset spans two fields. spec is the encoded spec, in which an unset field is absent.
func dashboardPreferencesResetErrors(reset []dashv2beta1.DashboardPreferencesResetPath, spec any) field.ErrorList {
	var errs field.ErrorList
	listed := make(map[dashv2beta1.DashboardPreferencesResetPath]bool, len(reset))
	for i, path := range reset {
		// Named like the schema's causes, which give a list entry's index as a path element.
		entry := field.NewPath("spec", "reset", strconv.Itoa(i))
		if listed[path] {
			errs = append(errs, field.Duplicate(entry, path))
			continue
		}
		listed[path] = true
		if isDashboardPreferencesFieldSet(spec, string(path)) {
			errs = append(errs, field.Invalid(entry, path, fmt.Sprintf("spec.%s is also set; a field can be set or reset, not both", path)))
		}
	}
	return errs
}

func isDashboardPreferencesFieldSet(spec any, path string) bool {
	value := spec
	for key := range strings.SplitSeq(path, ".") {
		obj, ok := value.(map[string]any)
		if !ok {
			return false
		}
		if value, ok = obj[key]; !ok {
			return false
		}
	}
	return true
}

func dashboardPreferencesSchemaErrorToField(err error) *field.Error {
	se, ok := errors.AsType[*openapi3.SchemaError](err)
	if !ok {
		return field.Invalid(field.NewPath("spec"), nil, err.Error())
	}
	return field.Invalid(field.NewPath("spec", se.JSONPointer()...), se.Value, se.Reason)
}
