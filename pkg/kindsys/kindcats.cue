package kindsys

import (
	"strings"

	"github.com/grafana/thema"
)

// A Kind is a specification for a type of object that Grafana knows
// how to work with. Each kind definition contains a schema, and some
// declarative metadata and constraints.
//
// An instance of a kind is called a resource. Resources are a sequence of
// bytes - for example, a JSON file or HTTP request body - that conforms
// to the schemas and other constraints defined in a Kind.
//
// Once Grafana has determined a given byte sequence to be an
// instance of a known Kind, kind-specific behaviors can be applied,
// requests can be routed, events can be triggered, etc.
//
// Grafana's kinds are similar to Kubernetes CustomResourceDefinitions.
// Grafana provides a standard mechanism for representing its kinds as CRDs.
//
// There are three categories of kinds: Core, Custom, and Composable.
Kind: Composable | Core | Custom

// properties shared between all kind categories.
_sharedKind: {
	// name is the canonical name of a Kind, as expressed in PascalCase.
	//
	// To ensure names are generally portable and amenable for consumption
	// in various mechanical tasks, name largely follows the relatively
	// strict DNS label naming standard as defined in RFC 1123:
	//  - Contain at most 63 characters
	//  - Contain only lowercase alphanumeric characters or '-'
	//  - Start with an uppercase alphabetic character
	//  - End with an alphanumeric character
	name: =~"^([A-Z][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])$"

	// machineName is the case-normalized (lowercase) version of [name]. This
	// version of the name is preferred for use in most mechanical contexts,
	// as case normalization ensures that case-insensitive and case-sensitive
	// checks will never disagree on uniqueness.
	//
	// In addition to lowercase normalization, dashes are transformed to underscores.
	machineName: strings.ToLower(strings.Replace(name, "-", "_", -1))

	// pluralName is the pluralized form of name.	Defaults to name + "s".
	pluralName: =~"^([A-Z][a-zA-Z0-9-]{0,61}[a-zA-Z])$" | *(name + "s")

	// pluralMachineName is the pluralized form of [machineName]. The same case
	// normalization and dash transformation is applied to [pluralName] as [machineName]
	// applies to [name].
	pluralMachineName: strings.ToLower(strings.Replace(pluralName, "-", "_", -1))

	// lineageIsGroup indicates whether the lineage in this kind is "grouped". In a
	// grouped lineage, each top-level field in the schema specifies a discrete
	// object that is expected to exist in the wild
	//
	// This field is set at the framework level, and cannot be in the declaration of
	// any individual kind.
	//
	// This is likely to eventually become a first-class property in Thema:
	// https://github.com/grafana/thema/issues/62
	lineageIsGroup: bool

	// lineage is the Thema lineage containing all the schemas that have existed for this kind.
	lineage: thema.#Lineage

	// currentVersion is computed to be the syntactic version number of the latest
	// schema in lineage.
	currentVersion: thema.#SyntacticVersion & (thema.#LatestVersion & {lin: lineage}).out

	maturity: #Maturity

	// The kind system itself is not mature enough yet for any single
	// kind to advance beyond "experimental"
	// TODO allow more maturity stages once system is ready https://github.com/orgs/grafana/projects/133/views/8
	maturity: *"merged" | "experimental"
}

// Maturity indicates the how far a given kind declaration is in its initial
// journey. Mature kinds still evolve, but with guarantees about compatibility.
#Maturity: "merged" | "experimental" | "stable" | "mature"

// Core specifies the kind category for core-defined arbitrary types.
// Familiar types and functional resources in Grafana, such as dashboards and
// and datasources, are represented as core kinds.
Core: S=close({
	_sharedKind

	lineage: { name: S.machineName }
	lineageIsGroup: false
})
