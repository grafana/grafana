package grafanaschema

// TODO this file absolutely has to move, as it's a utility that needs to be
// generally available to plugins, as well

#SchemaLineage: [{...}, ...{...}]
#LastSchema: {
    _p: #SchemaLineage
    _p[len(_p)-1]
}

// TODO define structures for migrations

#SchemaFamily: {
    // TODO This encodes the idea that schemata are organized into a series of
    // (backwards compatible) lineage sequences, with major and minor versions
    // corresponding to their position in the series of arrays. (i.e. the
    // first schema in the first lineage is 0.0.)
    // This approach can, and probably should, change. However, any approach 
    // will need to maintain certain properties: 
    //  - Specific versions of a schema can be extracted by querying the family
    //    for with version number
    //  - (Probably) individual schema do not internally define
    //    version fields, but instead rely on this SchemaFamily meta-structure to do it
	seqs: [#SchemaLineage, ...#SchemaLineage]
	let lseq = seqs[len(seqs)-1]
	latest: #LastSchema & { _p: lseq }

    // TODO add migration structures, once defined
}
