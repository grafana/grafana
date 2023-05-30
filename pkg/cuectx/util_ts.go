package cuectx

import (
	"fmt"
	"sort"
	"strings"

	"cuelang.org/go/cue/ast"
	tsast "github.com/grafana/cuetsy/ts/ast"
)

// CUE import paths, mapped to corresponding TS import paths. An empty value
// indicates the import path should be dropped in the conversion to TS. Imports
// not present in the list are not allowed, and code generation will fail.
var importMap = map[string]string{
	"github.com/grafana/thema":                                      "",
	"github.com/grafana/kindsys":                                    "",
	"github.com/grafana/grafana/pkg/plugins/pfs":                    "",
	"github.com/grafana/grafana/packages/grafana-schema/src/common": "@grafana/schema",
}

func init() {
	allow := PermittedCUEImports()
	strsl := make([]string, 0, len(importMap))
	for p := range importMap {
		strsl = append(strsl, p)
	}

	sort.Strings(strsl)
	sort.Strings(allow)
	if strings.Join(strsl, "") != strings.Join(allow, "") {
		panic("CUE import map is not the same as permitted CUE import list - these files must be kept in sync!")
	}
}

// PermittedCUEImports returns the list of import paths that may be imported in
// Grafana kind definitions.
func PermittedCUEImports() []string {
	return []string{
		"github.com/grafana/thema",
		"github.com/grafana/kindsys",
		"github.com/grafana/grafana/pkg/plugins/pfs",
		"github.com/grafana/grafana/packages/grafana-schema/src/common",
	}
}

// MapCUEImportToTS maps the provided CUE import path to the corresponding
// TypeScript import path in generated code.
//
// Providing an import path that is not allowed results in an error. If a nil
// error and empty string are returned, the import path should be dropped in
// generated code.
func MapCUEImportToTS(path string) (string, error) {
	i, has := importMap[path]
	if !has {
		return "", fmt.Errorf("import %q in models.cue is not allowed", path)
	}
	return i, nil
}

// ConvertImport converts a CUE import statement, represented in its AST form,
// to the corresponding TS import, if the CUE import is allowed.
//
// Some CUE imports are allowed but have no corresponding TS import - the CUE
// types from that package are expected to be inlined.
func ConvertImport(im *ast.ImportSpec) (tsast.ImportSpec, error) {
	tsim := tsast.ImportSpec{}
	pkg, err := MapCUEImportToTS(strings.Trim(im.Path.Value, "\""))
	if err != nil || pkg == "" {
		// err should be unreachable if paths has been verified already
		// Empty string mapping means skip it
		return tsim, err
	}

	tsim.From = tsast.Str{Value: pkg}

	if im.Name != nil && im.Name.String() != "" {
		tsim.AsName = im.Name.String()
	} else {
		sl := strings.Split(strings.Trim(im.Path.Value, "\""), "/")
		final := sl[len(sl)-1]
		if idx := strings.Index(final, ":"); idx != -1 {
			tsim.AsName = final[idx:]
		} else {
			tsim.AsName = final
		}
	}
	return tsim, nil
}
