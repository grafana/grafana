package load

import (
	"cuelang.org/go/cue"
	"github.com/grafana/grafana/pkg/schema"
)

type scuemata struct {
	first schema.VersionedCueSchema
}

func (df *scuemata) Validate(r schema.Resource) (schema.VersionedCueSchema, error) {
	arr := schema.AsArray(df)

	// Work from latest to earliest
	var err error
	for o := len(arr) - 1; o >= 0; o-- {
		for i := len(arr[o]) - 1; i >= 0; i-- {
			if err = arr[o][i].Validate(r); err == nil {
				return arr[o][i], nil
			}
		}
	}

	// TODO sloppy, return more than last error
	return nil, err
}

func (df *scuemata) First() schema.VersionedCueSchema {
	return df.first
}

func buildGenericFamily(famval cue.Value) (schema.Fam, error) {
	// TODO verify subsumption by #SchemaFamily; renders many
	// error checks below unnecessary
	majiter, err := famval.Lookup("seqs").List()
	if err != nil {
		return nil, err
	}

	scuem := &scuemata{}

	var major int
	var lastgvs *genericVersionedSchema
	for majiter.Next() {
		var minor int
		miniter, _ := majiter.Value().List()
		for miniter.Next() {
			gvs := &genericVersionedSchema{
				actual: miniter.Value(),
				major:  major,
				minor:  minor,
				// This gets overwritten on all but the very final schema
				migration: terminalMigrationFunc,
			}

			if scuem.first == nil {
				scuem.first = gvs
			}

			if minor != 0 {
				// TODO Verify that this schema is backwards compat with prior.
				// Create an implicit migration operation on the prior schema.
				lastgvs.migration = implicitMigration(gvs.actual, gvs)
				lastgvs.next = gvs
			} else if major != 0 {
				lastgvs.next = gvs
				// x.0. There should exist an explicit migration definition;
				// load it up and ready it for use, and place it on the final
				// schema in the prior sequence.
				//
				// Also...should at least try to make sure it's pointing at the
				// expected schema, to maintain our invariants?

				// TODO impl
			}
			lastgvs = gvs
			minor++
		}
		major++
	}

	// TODO stupid pointers not being references, fixme
	// for o, seq := range fam.Seqs {
	// 	for i, gen := range seq {
	// 		var next *genericVersionedSchema
	// 		if len(seq) == i+1 {
	// 			if len(fam.Seqs) == o+1 {
	// 				continue
	// 			}
	// 			next = fam.Seqs[o+1][0].(*genericVersionedSchema)
	// 		} else {
	// 			next = seq[i+1].(*genericVersionedSchema)
	// 		}
	// 		gvs := gen.(*genericVersionedSchema)
	// 		gvs.next = next
	// 		fam.Seqs[o][i] = gvs
	// 	}
	// }

	return scuem, nil
}
