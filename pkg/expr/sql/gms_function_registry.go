//go:build !arm

package sql

import (
	"strings"

	gmssql "github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression/function"
)

// gmsBuiltinFunctions indexes function.BuiltIns by name for IsKnownEngineFunction.
var gmsBuiltinFunctions = func() map[string]struct{} {
	m := make(map[string]struct{}, len(function.BuiltIns))
	for _, fn := range function.BuiltIns {
		m[fn.FunctionName()] = struct{}{}
	}
	return m
}()

// gmsExtraFunctions covers GMS functions that are registered separately by the
// engine outside of function.BuiltIns. These names are finite and well-known, so
// they are safe as metric label values.
var gmsExtraFunctions = func() map[string]struct{} {
	m := map[string]struct{}{
		"version": {},
	}
	for _, fn := range function.GetLockingFuncs(gmssql.NewLockSubsystem()) {
		m[strings.ToLower(fn.FunctionName())] = struct{}{}
	}
	return m
}()

// IsKnownEngineFunction reports whether name (case-insensitive) is a known
// go-mysql-server function. True means the name comes from a finite vocabulary
// and is safe as a Prometheus label value; false means it should be bucketed as "unknown".
func IsKnownEngineFunction(name string) bool {
	lower := strings.ToLower(name)
	_, inBuiltins := gmsBuiltinFunctions[lower]
	_, inExtra := gmsExtraFunctions[lower]
	return inBuiltins || inExtra
}
