package registry

import (
	"github.com/grafana/thema"
)

// ProvideStatic provides access to individual coremodels via explicit method calls.
//
// Prefer this to the ProvideGeneric type when your code works with known,
// specific coremodels(s), rather than generically across all of them. This
// allows standard Go static analysis tools to determine which code is depending
// on particular coremodels.
//
// This will use the default Grafana thema.Library, defined in pkg/cuectx, which
// will avoid duplicate parsing of Thema CUE schemas. If you need control over the
// thema.Library in use, use ProvideStaticWithLib instead.
func ProvideStatic() (*Static, error) {
	return provideStatic(nil)
}

// ProvideStaticWithLib is the same as ProvideStatic, but
// allows control over the thema.Library used to initialize the underlying
// coremodels.
//
// Prefer ProvideStatic unless you absolutely need this control.
func ProvideStaticWithLib(lib thema.Library) (*Static, error) {
	return provideStatic(&lib)
}

// ProvideGeneric provides a simple Generic registry of all coremodels.
//
// Prefer this to the static ProvideStatic when your code needs to
// work with all coremodels generically, rather than specific coremodels.
func ProvideGeneric() (*Generic, error) {
	return provideGeneric()
}

// NOTE - no ProvideRegistryWithLib is defined because there are no anticipated
// cases where a caller would need to operate generically across all coremodels,
// and control the library they're initialized with. If that changes, add one.
