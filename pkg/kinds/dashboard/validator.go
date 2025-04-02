package dashboard

import (
	"context"
	_ "embed"
	json "encoding/json"
	fmt "fmt"
	"strings"
	"sync"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/cuecontext"
	"cuelang.org/go/cue/errors"
	cuejson "cuelang.org/go/encoding/json"
	"k8s.io/apimachinery/pkg/util/validation/field"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// ValidateDashboardSpec validates a JSON object against the dashboard kind schema.
func ValidateDashboardSpec(ctx context.Context, obj common.Unstructured) field.ErrorList {
	data, err := json.Marshal(obj.Object)
	if err != nil {
		return field.ErrorList{
			field.Invalid(field.NewPath("spec"), field.OmitValueType{}, err.Error()),
		}
	}

	if err := cuejson.Validate(data, getSchema()); err != nil {
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

		return errs
	}

	return nil
}

func formatErrorPath(path []string) string {
	// omitting the "lineage.schemas[0].schema.spec" prefix here.
	return strings.Join(path[4:], ".")
}

var (
	schema        cue.Value
	getSchemaOnce sync.Once
)

//go:embed dashboard_kind.cue
var schemaSource string

func getSchema() cue.Value {
	getSchemaOnce.Do(func() {
		cueCtx := cuecontext.New()
		schema = cueCtx.CompileString(schemaSource).LookupPath(
			cue.ParsePath("lineage.schemas[0].schema.spec"),
		)
	})

	return schema
}
