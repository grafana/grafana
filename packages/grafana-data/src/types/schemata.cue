package grafanaschema

// TODO this file absolutely has to move, as it's a utility that needs to be
// generally available to plugins, as well

// A Seq is a series of schemas that all describe a single kind of object.
// TODO different type for v0 that doesn't entail backwards compatibility?
#Seq: [{...}, ...{...}]
#LastSchema: {
    _p: #Seq
    _p[len(_p)-1]
}

#SchemaFamily: {
	seqs: [#Seq, ...#Seq]
    migrations: [...#Migration]
}

// Individual schema governing a panel plugin.
//
// These keys do not appear directly in any real JSON artifact; rather, they are
// composed into panel structures as they are defined within the larger
// Dashboard schema.
#PanelModel: {
    PanelOptions: {...}
    PanelFieldConfig: {...}
}

// Schema sequence of panel model schema
#PanelModelSeq: [#PanelModel, ...#PanelModel]

// Panel plugin-specific SchemaFamily
#PanelModelFamily: {
    seqs: [#PanelModelSeq, ...#PanelModelSeq]
    migrations: [...#Migration]
}

// A Migration defines a relation between two schemata, "_from" and "_to". The
// relation expresses any complex mappings that must be performed to
// transform an input artifact valid with respect to the _from schema, into
// an artifact valid with respect to the _to schema. This is accomplished
// in two stages:
//   1. A Migration is initially defined by passing in schemata for _from and _to,
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
    _from: {...}
    _to: {...}
    _rel: {...}
    result: _to & _rel
}
