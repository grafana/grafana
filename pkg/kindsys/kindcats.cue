package kindsys

import (
	"strings"

	"github.com/grafana/thema"
)

// A Kind specifies a type of Grafana resource.
//
// An instance of a Kind is called an entity. An entity is a sequence of bytes -
// for example, a JSON file or HTTP request body - that conforms to the
// constraints defined in a Kind, and enforced by Grafana's entity system.
//
// Once Grafana has determined a given byte sequence to be an
// instance of a known Kind, kind-specific behaviors can be applied,
// requests can be routed, events can be triggered, etc.
//
// Classes and objects in most programming languages are analogous:
//   - #Kind is like a `class` keyword
//   - Each declaration of #Kind is like a class declaration
//   - Byte sequences are like arguments to the class constructor
//   - Entities are like objects - what's returned from the constructor
//
// There are four categories of kinds: Raw, Composable, CoreStructured,
// and CustomStructured.
#Kind: #Raw | #Composable | #CoreStructured | #CustomStructured

// properties shared between all kind varieties.
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

	maturity: #Maturity

	// The kind system itself is not mature enough yet for any single
	// kind to be called "mature."
	// TODO remove this once system is ready https://github.com/orgs/grafana/projects/133/views/8
	maturity: "committed" | "experimental" | "stable"

	// form indicates whether the kind has a schema ("structured") or not ("raw")
	form: "structured" | "raw"
}

// Maturity indicates the how far a given kind declaration is in its initial
// journey. Mature kinds still evolve, but with guarantees about compatibility.
#Maturity: "committed" | "experimental" | "stable" | "mature"

// Structured encompasses all three of the structured kind categories, in which
// a schema specifies validity rules for the byte sequence. These represent all
// the conventional types and functional resources in Grafana, such as
// dashboards and datasources.
//
// Structured kinds may be defined either by Grafana itself (#CoreStructured),
// or by plugins (#CustomStructured). Plugin-defined kinds have a slightly
// reduced set of capabilities, due to the constraints imposed by them being run
// in separate processes, and the risks arising from executing code from
// potentially untrusted third parties.
#Structured: S={
	_sharedKind
	form: "structured"

	// lineage is the Thema lineage containing all the schemas that have existed for this kind.
	// It is required that lineage.name is the same as the [machineName].
	lineage: thema.#Lineage & { name: S.machineName }

	currentVersion: thema.#SyntacticVersion & (thema.#LatestVersion & {lin: lineage}).out
}
