package kindsys

import (
	"github.com/grafana/thema"
)

// A Kind is the definition of a first-class type in Grafana's entity system.
//
// An entity is a sequence of bytes - for example, a JSON file or HTTP request
// body - that conforms to the constraints defined in a Kind, and
// enforced by Grafana's entity system.
//
// Once Grafana's entity system has determined a given byte sequence to be an
// instance of a known Kind, type-specific behaviors can be applied,
// requests can be routed, events can be triggered, etc.
//
// Classes and objects in most programming languages are analogous:
//   - #Kind is like a `class` keyword
//   - Each declaration of #Kind is like a class declaration
//   - Byte sequences are like arguments to the class constructor
//   - Entities are like objects - what's returned from the constructor
//
// There are four essential categories of kinds: Raw, Slot, CoreStructured and CustomStructured.
#Kind: #Raw | #Slot | #CoreStructured | #CustomStructured

// properties shared between all kind varieties.
_sharedKind: {
	// name is the canonical, machine-friendly name of a Kind.
	//
	// name is often used in generated code intended to be parsed be parsed or used
	// by machines, so it follows the relatively strict DNS label naming standard,
	// as defined in RFC 1123:
	//  - Contain at most 63 characters
	//  - Contain only lowercase alphanumeric characters or '-'
	//  - Start with an alphabetic character
	//  - End with an alphanumeric character
	name: =~"^([a-z][a-z0-9-]{0,61}[a-z0-9])$"

	// TODO need some fields related to other names, human names - pluralization, capitalization
	// it's all necessary for conversion to CRDs

	// maturity indicates the how far a given kind declaration is in its initial
	// journey towards what might otherwise be referred to as 1.0.
	maturity: "committed" | "experimental" | "stable" | "mature"

	// The kind system itself is not mature enough yet for any single
	// kind to be called "mature."
	// TODO remove this once system is ready https://github.com/orgs/grafana/projects/133/views/8
	maturity: "committed" | "experimental" | "stable"

	form: "structured" | "raw"
}

// Raw is a category of Kind that specifies handling for a raw file,
// like an image, or an svg or parquet file. Grafana mostly acts as asset storage for raw
// types: the byte sequence is a black box to Grafana, and type is determined
// through metadata such as file extension.
#Raw: {
	_sharedKind
	form: "raw"
	extensions?: [...string]

	maturity: *"experimental" | "mature" // TODO unclear if we want maturity for raw kinds

	// known TODOs
	// - sanitize function
	// - get summary
}

// Structured encompasses all three of the structured kind categories, in which
// a schema specifies validity rules for the byte sequence. These represent all
// the conventional types and functional resources in Grafana, such as
// dashboards and datasources.
//
// Structured types may be defined either by Grafana itself (#CoreStructured),
// or by plugins (#CustomStructured). Plugin-defined types have a slightly
// reduced set of capabilities, due to the constraints imposed by them being run
// in separate processes, and the risks arising from executing code from
// potentially untrusted third parties.
#Structured: S={
	_sharedKind
	form: "structured"

	// lineage is the Thema lineage containing all the schemas that have existed for this kind.
	// It is required that lineage.name is the same as the kind's name.
	lineage: thema.#Lineage & { name: S.name }

	currentVersion: thema.#SyntacticVersion & (thema.#LatestVersion & {lin: lineage}).out
}
