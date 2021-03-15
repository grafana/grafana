package grafanaschema

// TODO THIS SHOULD NOT BE HERE IT'S A SLOPPY COPY TO GET A DEMO TOGETHER. KILL
// IT DEAD WITH BETTER FILE ORGANIZATION!

// A Seq is a series of schemas that all describe a single kind of object.
// TODO use #Schema
// TODO different type for v0 that doesn't entail backwards compatibility?
#Seq: [{...}, ...{...}]
#LastSchema: {
    _p: #Seq
    _p[len(_p)-1]
}

#SchemaFamily: {
    // Kind is the canonical name of the object that all schemata in the Family
    // describe.
    Kind?: string

    // TODO This encodes the idea that schemata are organized into a series of
    // (backwards compatible) lineage sequences, with major and minor versions
    // corresponding to their position in the series of arrays. (i.e. the
    // first schema in the first lineage is 0.0.)
    // This approach can, and probably should, change. However, any approach 
    // will need to maintain certain properties: 
    //  - Specific versions of a schema can be extracted by querying the family
    //    with version number
    //  - (Probably) individual schema do not internally define
    //    version fields, but instead rely on this SchemaFamily meta-structure to do it
	seqs: [#Seq, ...#Seq]
	let lseq = seqs[len(seqs)-1]
	latest: #LastSchema & { _p: lseq }

    // Enforce that schemata within a seq are backwards compatible.
    _bccheck: {
        for ov, seq in seqs {
            for iv, schema in seq if iv > 0 {
                // Key the check on the schema being checked
                "\(ov).\(iv)": seq[iv-1] & close(schema)
                // TODO either here or in another loop, automatically create migrations
                // for 
            }
        }
    }
}

// An individual schema governing a panel plugin's persistable configuration.
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
	let lseq = seqs[len(seqs)-1]
	latest: #LastSchema & { _p: lseq }
}

// This helper properly belongs being declared with dashboards,
// as the output is tied to the particular structure of dashboards.
_discriminatedPanel: {
    _in: {
        model: #PanelModel
        type: string
    }
    result: {
        type: _in.type
        options: _in.model.PanelOptions
        fieldConfig: defaults: custom: _in.model.PanelFieldConfig
    }
}

// A Migration defines a relation between two schemata, "_from" and "_to". The
// relation expresses any complex mappings that must be performed to
// transform an input artifact valid with respect to the _from schema, into
// an artifact valid with respect to the _to schema. This is accomplished
// in two stages:
//   1. A Migration is initially defined by passing in schemata for _from and _to,
//      and mappings that translate _from to _to are defined in _rel. 
//   2. A concrete object may then be unified with _to, resulting in its values
//      being mapped onto "output" by way of _rel.
//
// This is the absolute simplest possible definition of a Migration. It's
// incumbent on the implementor to manually ensure the correctness and
// completeness of the mapping. The primary value in defining a generic
// structure for this is to allow similarly generic logic for pushing
// concrete artifacts through schema changes.
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
    output: _to & _rel
}
