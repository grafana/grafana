package kind

// THIS FILE IS AN EXPERIMENTAL THOUGHT EXERCISE. NAMES AND RULES ARE SUBJECT TO CHANGE.
// AND DISCUSSION IS ENCOURAGED. IT IS NOT USED AND DOES NOT IMPACT ANY GRAFANA BEHAVIOR.
//
// The only things we _really_ know for sure are:
// - the name "coremodel" is terrible and needs to go away
// - grafana is moving to schema-centric development
// - schema-centric development entails things like a consistent API,
//   storage, and docs framework and/or codegen
// - if grafana is to have a consistent framework for types that it accepts and
//   stores via an API, it must also support non-schematized types (raw files)
// - THESE THINGS NEED PRECISE NAMES OR WE WILL ALL LOSE OUR DAMN MINDS
// - all of this will only be successful if we work out an iterative transitional
//   path - no big bang!
//
// This file is committed because:
// - the functional role it will eventually play is defined in a design doc https://bit.ly/3McWhvB
// - committing a skeleton like this is an iterative step towards actually implementing ^
// - @sdboyer keeps recreating this ad hoc in 1:1s to illustrate the concept

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
// There are two fundamental varieties of Kinds: Raw and Structured.
#Kind: #Raw | #Structured

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

	// The kind system itself is not mature enough yet for any particula
	// kind to be called "mature."
	 // TODO remove this once system is ready https://github.com/orgs/grafana/projects/133/views/8
	maturity: "committed" | "experimental" | "stable"

	form: "structured" | "raw"
}

// Raw is a variety of Kind that specifies a type for a raw file,
// like an svg or parquet file. Grafana mostly acts as asset storage for raw
// types: the byte sequence is a black box to Grafana, and type is determined
// through metadata such as file extension.
#Raw: {
	_sharedKind
	form: "raw"
	extensions?: [...string]

	maturity: *"experimental" | "mature" // TODO unclear if we want maturity for raw kinds

	// Set this if there's a sanitize function that should be associated with this
	// raw type. A call to the named function will be generated.
	// TODO decide where this gets generated - almost certainly must be outside pkg/kind tree
	//
	// The function must conform to (TODO decide on a type signature)
	sanitizeFuncName?: string

	// need
	// - sanitize function
	// - get summary
}

// Structured is a variety of Kind where a schema specifies
// validity rules for the byte sequence. These represent all the conventional
// types and functional resources in Grafana, such as dashboards and datasources.
//
// Structured types may be defined either by Grafana itself (core types), or by
// plugins. Plugin-defined types have a slightly reduced set of capabilities,
// due to the constraints imposed by them being run in separate processes, and
// the risks arising from executing code from potentially untrusted third parties.
#Structured: {
	_sharedKind
	form:     "structured"

	lineage:  thema.#Lineage

	// currentVersion is the syntactic version of the lineage's latest schema.
	currentVersion: thema.#SyntacticVersion & (thema.#LatestVersion & { lin: lineage }).out
}

// TODO
#CoreStructured: {
	#Structured
	maturity: *"committed" | "experimental" | "stable" | "mature"
}

// TODO
CustomStructured: {
	#Structured
	maturity: *"experimental" | "mature"
}

// SlotKind is a variety of structured kind that provides schema elements for
// composition into CoreStructured and CustomStructured kinds. Grafana plugins
// provide SlotKinds; for example, a datasource plugin provides a SlotKind to
// describe the structure of its queries, which is then composed into dashboards
// and alerting rules.
//
// Each SlotKind is an implementation of exactly one Slot, a shared meta-schema
// defined by Grafana itself that constrains the shape of schemas declared in
// that SlotKind.
#SlotKind: {
	_sharedKind
	form: "structured"

	maturity: *"experimental" | "mature"
}
