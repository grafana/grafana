package scuemata

// A family is a collection of schemas that specify a single kind of object,
// allowing evolution of the canonical schema for that kind of object over time.
//
// The schemas are organized into a list of Seqs, which are themselves ordered
// lists of schemas where each schema within a Seq is backwards compatible with
// the schema that precedes it.
//
// If it is desired to define a schema with a breaking schema relative to its
// predecessors, a new Seq must be created, as well as a Migration that defines
// a mapping from the most recent schema in the old Seq to the new schema.
//
// The version number of a schema is not controlled by the schema itself, but by
// its position in the seqs - e.g., the first schema in the first seq is 0.0
#Family: {
	seqs: [#Seq, ...#Seq]
    migrations: [...#Migration]
	let lseq = seqs[len(seqs)-1]
	latest: #LastSchema & { _p: lseq }
}

// A Seq is a list containing an ordered series of schemas that all describe a
// single kind of object, and each schema is backwards compatible with its
// predecessor.
#Seq: [{...}, ...{...}]


#SchemaLineage: [{...}, ...{...}]
#LastSchema: {
    _p: #SchemaLineage
    _p[len(_p)-1]
}

// Individual schema governing a panel plugin.
//
// These keys do not appear directly in any real JSON artifact; rather, they are
// composed into panel structures as they are defined within the larger
// Dashboard schema.
#PanelSchema: {
    PanelOptions: {...}
    PanelFieldConfig: {...}
}

// Schema sequence of panel schema
#PanelSeq: [#PanelSchema, ...#PanelSchema]

// Panel plugin-specific SchemaFamily
#PanelFamily: {
    seqs: [#PanelSeq, ...#PanelSeq]
    migrations: [...#Migration]
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