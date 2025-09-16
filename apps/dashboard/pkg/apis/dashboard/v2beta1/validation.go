package v2beta1

import (
	_ "embed"
	json "encoding/json"
	fmt "fmt"
	"strings"
	"sync"

	"k8s.io/apimachinery/pkg/util/validation/field"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/cuecontext"
	"cuelang.org/go/cue/errors"
	cuejson "cuelang.org/go/encoding/json"
)

func ValidateDashboardSpec(obj *Dashboard) field.ErrorList {
	data, err := json.Marshal(obj.Spec)
	if err != nil {
		return field.ErrorList{
			field.Invalid(field.NewPath("spec"), field.OmitValueType{}, err.Error()),
		}
	}

	// Custom validation for action query params and headers
	validateAndTrimActionArrays(obj)

	if err := cuejson.Validate(data, getCueSchema()); err != nil {
		errs := field.ErrorList{}

		for _, e := range errors.Errors(err) {
			if
			// We don't want to return confusing "empty disjunction" errors,
			// because the users don't necessarily understand what to do with them.
			// For empty disjunctions, CUE will also return more specific errors,
			// so we can safely ignore the generic ones.
			strings.Contains(e.Error(), "disjunction") ||
				// We don't want to return errors about unknown fields either.
				strings.Contains(e.Error(), "field not allowed") {
				continue
			}

			if strings.Contains(e.Error(), "mismatched types null and list") {
				// Go populates empty slices as nil, which the cue validator does not like
				continue
			}

			// We want to manually format the error message,
			// because e.Error() contains the full CUE path.
			format, args := e.Msg()

			errs = append(errs, field.Invalid(
				field.NewPath(formatErrorPath(e.Path())),
				field.OmitValueType{},
				fmt.Sprintf(format, args...),
			))
		}

		return errs
	}

	return nil
}

// Validates and trims action query params and headers to exactly 2 elements each
// This is because we couldn't generate with cue a go struct that would have exactly two strings in each sub-array
func validateAndTrimActionArrays(obj *Dashboard) {
	for _, element := range obj.Spec.Elements {
		if element.PanelKind != nil {
			panelElement := element.PanelKind
			if panelElement.Spec.VizConfig.Spec.FieldConfig.Defaults.Actions != nil {
				processActions(panelElement.Spec.VizConfig.Spec.FieldConfig.Defaults.Actions)
			}
		}
	}
}

// Helper function to process action arrays
func processActions(actions []DashboardAction) {
	for _, action := range actions {
		// Process FetchOptions if present
		if action.Fetch != nil {
			if action.Fetch.QueryParams != nil {
				action.Fetch.QueryParams = trimStringArrays(action.Fetch.QueryParams)
			}
			if action.Fetch.Headers != nil {
				action.Fetch.Headers = trimStringArrays(action.Fetch.Headers)
			}
		}

		// Process InfinityOptions if present
		if action.Infinity != nil {
			if action.Infinity.QueryParams != nil {
				action.Infinity.QueryParams = trimStringArrays(action.Infinity.QueryParams)
			}
			if action.Infinity.Headers != nil {
				action.Infinity.Headers = trimStringArrays(action.Infinity.Headers)
			}
		}
	}
}

// Helper function to trim 2D string arrays to exactly 2 elements per sub-array
func trimStringArrays(arrays [][]string) [][]string {
	if arrays == nil {
		return arrays
	}

	result := make([][]string, len(arrays))
	for i, arr := range arrays {
		if len(arr) > 2 {
			result[i] = arr[:2]
		} else {
			result[i] = arr
		}
	}
	return result
}

func formatErrorPath(path []string) string {
	return strings.Join(path, ".")
}

var (
	compiledSchema cue.Value
	getSchemaOnce  sync.Once
)

//go:embed dashboard_spec.cue
var schemaSource string

func getCueSchema() cue.Value {
	getSchemaOnce.Do(func() {
		cueCtx := cuecontext.New()
		compiledSchema = cueCtx.CompileString(schemaSource).LookupPath(
			cue.ParsePath("DashboardSpec"),
		)
	})

	return compiledSchema
}
