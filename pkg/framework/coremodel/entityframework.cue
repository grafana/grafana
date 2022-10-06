package entity

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



// An EntityType defines a type in Grafana's entity system.
//
// An entity is a sequence of bytes - for example, a JSON file or HTTP request
// body - that conforms to the constraints defined in an EntityType, and
// enforced by Grafana's entity system.
//
// Once Grafana's entity system has determined a given byte sequence to be an
// instance of a known EntityType, type-specific behaviors can be applied,
// requests can be routed, events can be fired, etc.
//
// Classes and objects in most programming languages are analogous:
//   - EntityType is like a `class` keyword
//   - Each declaration of #EntityType is like a class declarations
//   - Byte sequences are like arguments to the class's constructor
//   - Entities are like objects - what's returned from the constructor
//
// There are two fundamental kinds of EntityTypes: RawEntityType and StructuredEntityType.
#EntityType: #RawEntityType | #StructuredEntityType


// properties shared between all kinds of entity types.
_sharedKind: {
	// kind is the canonical, machine-friendly name of an EntityType.
	//
	// kind is often used in generated code intended to
	// be parsed or used by machines, so it follows the relatively
	// strict DNS label naming standard, as defined in RFC 1123:
	//  - Contain at most 63 characters
	//  - Contain only lowercase alphanumeric characters or '-'
	//  - Start with an alphabetic character
	//  - End with an alphanumeric character
	kind: =~ "^([a-z][a-z0-9-]{0,61}[a-z0-9])$"

	// TODO need some fields related to other names, human names - pluralization, capitalization
	// it's all necessary for conversion to CRDs

	form: "structured" | "raw"
}


// A RawEntityType is a kind of EntityType that specifies a type for a raw file,
// like an svg or parquet file. Grafana mostly acts as asset storage for raw
// types: the byte sequence is a black box to Grafana, and type is determined
// through metadata such as file extension.
#RawEntityType: {
	_sharedKind
	form: "raw"
	extensions?: string
	// need
	// - sanitize function
	// - get summary
}

// A StructuredEntityType is a kind of EntityType where a schema specifies
// validity rules for the byte sequence. These represent all the conventional
// types and functional resources in Grafana, such as dashboards and datasources.
//
// Structured types may be defined either by Grafana itself (core types), or by
// plugins. Plugin-defined types have a slightly reduced set of capabilities,
// due to the constraints imposed by them being run in separate processes, and
// the risks arising from executing code from potentially untrusted third parties.
#StructuredEntityType: {
	_sharedKind
	maturity: *"committed" | "synchronized" | "mature"
	form: "structured"
  lineage: #thema.Lineage
}

#CoreStructuredEntityType: {
	#StructuredEntityType
}

#CustomStructuredEntityType: {
	#StructuredEntityType
}

