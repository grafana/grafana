package kindsys

import "github.com/grafana/thema"

// CommonProperties contains the metadata common to all categories of kinds.
type CommonProperties struct {
	Name              string   `json:"name"`
	PluralName        string   `json:"pluralName"`
	MachineName       string   `json:"machineName"`
	PluralMachineName string   `json:"pluralMachineName"`
	LineageIsGroup    bool     `json:"lineageIsGroup"`
	Maturity          Maturity `json:"maturity"`
}

// RawProperties represents the static properties in a #Raw kind declaration that are
// trivially representable with basic Go types.
//
// When a .cue #Raw declaration is loaded through the standard [LoadCoreKind],
// func, it is fully validated and populated according to all rules specified
// in CUE for #Raw kinds.
type RawProperties struct {
	CommonProperties
	Extensions []string `json:"extensions"`
}

func (m RawProperties) _private() {}
func (m RawProperties) Common() CommonProperties {
	return m.CommonProperties
}

// CoreStructuredProperties represents the static properties in the declaration of a
// #CoreStructured kind that are representable with basic Go types. This
// excludes Thema schemas.
//
// When a .cue #CoreStructured declaration is loaded through the standard [LoadCoreKind],
// func, it is fully validated and populated according to all rules specified
// in CUE for #CoreStructured kinds.
type CoreStructuredProperties struct {
	CommonProperties
	CurrentVersion thema.SyntacticVersion `json:"currentVersion"`
}

func (m CoreStructuredProperties) _private() {}
func (m CoreStructuredProperties) Common() CommonProperties {
	return m.CommonProperties
}

// CustomStructuredProperties represents the static properties in the declaration of a
// #CustomStructured kind that are representable with basic Go types. This
// excludes Thema schemas.
type CustomStructuredProperties struct {
	CommonProperties
	CurrentVersion thema.SyntacticVersion `json:"currentVersion"`
}

func (m CustomStructuredProperties) _private() {}
func (m CustomStructuredProperties) Common() CommonProperties {
	return m.CommonProperties
}

// ComposableProperties represents the static properties in the declaration of a
// #Composable kind that are representable with basic Go types. This
// excludes Thema schemas.
type ComposableProperties struct {
	CommonProperties
	CurrentVersion thema.SyntacticVersion `json:"currentVersion"`
}

func (m ComposableProperties) _private() {}
func (m ComposableProperties) Common() CommonProperties {
	return m.CommonProperties
}

// SomeKindProperties is an interface type to abstract over the different kind
// property struct types: [RawProperties], [CoreStructuredProperties],
// [CustomStructuredProperties], [ComposableProperties].
//
// It is the traditional interface counterpart to the generic type constraint
// KindProperties.
type SomeKindProperties interface {
	_private()
	Common() CommonProperties
}

// KindProperties is a type parameter that comprises the base possible set of
// kind metadata configurations.
type KindProperties interface {
	RawProperties | CoreStructuredProperties | CustomStructuredProperties | ComposableProperties
}
