package v0alpha1

import (
	_ "embed"
	json "encoding/json"
	fmt "fmt"
	"strings"
	"sync"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/cuecontext"
	"cuelang.org/go/cue/errors"
	cuejson "cuelang.org/go/encoding/json"
)

func ValidateDashboardSpec(obj *Dashboard, forceValidation bool) (field.ErrorList, field.ErrorList) {
	var schemaVersionError field.ErrorList
	schemaVersion := schemaversion.GetSchemaVersion(obj.Spec.Object)
	if schemaVersion != schemaversion.LATEST_VERSION {
		schemaVersionError = field.ErrorList{field.Invalid(field.NewPath("spec", "schemaVersion"), field.OmitValueType{}, fmt.Sprintf("Schema version %d is not supported - please upgrade to %d", schemaVersion, schemaversion.LATEST_VERSION))}
		if !forceValidation {
			return nil, schemaVersionError
		}
	}

	data, err := json.Marshal(obj.Spec.Object)
	if err != nil {
		return field.ErrorList{
			field.Invalid(field.NewPath("spec"), field.OmitValueType{}, err.Error()),
		}, schemaVersionError
	}

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

			// We want to manually format the error message,
			// because e.Error() contains the full CUE path.
			format, args := e.Msg()

			errs = append(errs, field.Invalid(
				field.NewPath(formatErrorPath(e.Path())),
				field.OmitValueType{},
				fmt.Sprintf(format, args...),
			))
		}

		return errs, schemaVersionError
	}

	return nil, schemaVersionError
}

func formatErrorPath(path []string) string {
	// omitting the "lineage.schemas[0].schema.spec" prefix here.
	return strings.Join(path[4:], ".")
}

var (
	compiledSchema cue.Value
	getSchemaOnce  sync.Once
)

//go:embed dashboard_kind.cue
var schemaSource string

func getCueSchema() cue.Value {
	getSchemaOnce.Do(func() {
		cueCtx := cuecontext.New()
		compiledSchema = cueCtx.CompileString(schemaSource).LookupPath(
			cue.ParsePath("lineage.schemas[0].schema.spec"),
		)
	})

	return compiledSchema
}
