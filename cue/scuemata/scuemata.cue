package scuemata

// A family is a collection of schemas that specify a single kind of object,
// allowing evolution of the canonical schema for that kind of object over time.
//
// The schemas are organized into a list of Lineages, which are themselves ordered
// lists of schemas where each schema with its predecessor in the lineage.
//
// If it is desired to define a schema with a breaking schema relative to its
// predecessors, a new Lineage must be created, as well as a Migration that defines
// a mapping to the new schema from the latest schema in prior Lineage.
//
// The version number of a schema is not controlled by the schema itself, but by
// its position in the list of lineages - e.g., 0.0 corresponds to the first
// schema in the first lineage.
#Family: {
	lineages: [#Lineage, ...#Lineage]
	migrations: [...#Migration]
	let lseq = lineages[len(lineages)-1]
	latest: #LastSchema & {_p: lseq}
}

// A Lineage is a non-empty list containing an ordered series of schemas that
// all describe a single kind of object, where each schema is backwards
// compatible with its predecessor.
#Lineage: [{...}, ...{...}]

#LastSchema: {
	_p: #Lineage
	_p[len(_p)-1]
}

// A Migration defines a relation between two schemas, "_from" and "_to". The
// relation expresses any complex mappings that must be performed to
// transform an input artifact valid with respect to the _from schema, into
// an artifact valid with respect to the _to schema. This is accomplished
// in two stages:
//   1. A Migration is initially defined by passing in schemas for _from and _to,
//      and mappings that translate _from to _to are defined in _rel. 
//   2. A concrete object may then be unified with _to, resulting in its values
//      being mapped onto "result" by way of _rel.
//
// This is the absolute simplest possible definition of a Migration. It's
// incumbent on the implementor to manually ensure the correctness and
// completeness of the mapping. The primary value in defining such a generic
// structure is to allow comparably generic logic for migrating concrete
// artifacts through schema changes.
//
// If _to isn't backwards compatible (accretion-only) with _from, then _rel must
// explicitly enumerate every field in _from and map it to a field in _to, even
// if they're identical. This is laborious for anything outside trivially tiny
// schema. We'll want to eventually add helpers for whitelisting or blacklisting
// of paths in _from, so that migrations of larger schema can focus narrowly on
// the points of actual change.
#Migration: {
	from: {...}
	to: {...}
	rel: {...}
	result: to & rel
}
