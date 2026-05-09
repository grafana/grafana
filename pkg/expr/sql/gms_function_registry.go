//go:build !arm

package sql

import (
	"strings"

	gmssql "github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression/function"
)

// gmsBuiltinFunctions is the set of function names registered in
// go-mysql-server's default built-in function registry, built once at startup
// from function.BuiltIns. Used solely for metric label bounding: it does not
// affect which functions are allowed to execute (that is IsAllowedFunctionName's job).
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
// go-mysql-server function — either in its default built-in registry or in
// the small set of functions registered separately by the engine. A true
// result means the name is safe to use as a Prometheus label value because it
// comes from a bounded, well-known vocabulary. A false result means the name
// may be arbitrary user-supplied text and should be recorded as "unknown".
func IsKnownEngineFunction(name string) bool {
	lower := strings.ToLower(name)
	_, inBuiltins := gmsBuiltinFunctions[lower]
	_, inExtra := gmsExtraFunctions[lower]
	return inBuiltins || inExtra
}
