package analysisutil

import (
	"go/types"
	"strings"
)

// RemoVendor removes vendoring infomation from import path.
func RemoveVendor(path string) string {
	i := strings.Index(path, "vendor")
	if i >= 0 {
		return path[i+len("vendor")+1:]
	}
	return path
}

// LookupFromImports finds an object from import paths.
func LookupFromImports(imports []*types.Package, path, name string) types.Object {
	path = RemoveVendor(path)
	for i := range imports {
		if path == RemoveVendor(imports[i].Path()) {
			return imports[i].Scope().Lookup(name)
		}
	}
	return nil
}
