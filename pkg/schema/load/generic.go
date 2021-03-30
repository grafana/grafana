package load

import (
	"cuelang.org/go/cue"
	"cuelang.org/go/cue/load"
	"github.com/grafana/grafana/pkg/schema"
)

// getBaseScuemata attempts to load the base scuemata family and schema
// definitions on which all Grafana scuemata rely.
//
// TODO probably cache this or something
func getBaseScuemata(p BaseLoadPaths) (*cue.Instance, error) {
	overlay := make(map[string]load.Source)
	if err := toOverlay("/grafana", p.BaseCueFS, overlay); err != nil {
		return nil, err
	}

	cfg := &load.Config{
		Overlay: overlay,
		Package: "scuemata",
		// TODO Semantics of loading instances is quite confusing. This has to
		// be set to "/" in order for the overlay to be searched and have all
		// files loaded in the cue/scuemata directory. (This isn't necessary
		// when loading individual .cue files.) But anchoring a search at root
		// seems like we're begging for vulnerabilities where Grafana can read
		// and print out anything on the filesystem, which can be a disclosure
		// problem, unless we're absolutely sure the search is within a virtual
		// filesystem. Which i'm not.
		//
		// And no, changing the toOverlay() to have a subpath and the
		// load.Instances to mirror that subpath does not allow us to get rid of
		// this "/".
		// Dir: "/",
	}
	return rt.Build(load.Instances([]string{"/grafana/cue/scuemata"}, cfg)[0])
}

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

func buildGenericScuemata(famval cue.Value) (schema.Fam, error) {
	// TODO verify subsumption by #SchemaFamily; renders many
	// error checks below unnecessary
	majiter, err := famval.Lookup("lineages").List()
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
			} else {
				scuem.first = gvs
			}
			lastgvs = gvs
			minor++
		}
		major++
	}

	return scuem, nil
}

type genericVersionedSchema struct {
	actual    cue.Value
	major     int
	minor     int
	next      *genericVersionedSchema
	migration migrationFunc
}

// Validate checks that the resource is correct with respect to the schema.
func (gvs *genericVersionedSchema) Validate(r schema.Resource) error {
	rv, err := rt.Compile("resource", r.Value)
	if err != nil {
		return err
	}
	return gvs.actual.Unify(rv.Value()).Validate(cue.Concrete(true))
}

// ApplyDefaults returns a new, concrete copy of the Resource with all paths
// that are 1) missing in the Resource AND 2) specified by the schema,
// filled with default values specified by the schema.
func (gvs *genericVersionedSchema) ApplyDefaults(_ schema.Resource) (schema.Resource, error) {
	panic("not implemented") // TODO: Implement
}

// TrimDefaults returns a new, concrete copy of the Resource where all paths
// in the  where the values at those paths are the same as the default value
// given in the schema.
func (gvs *genericVersionedSchema) TrimDefaults(_ schema.Resource) (schema.Resource, error) {
	panic("not implemented") // TODO: Implement
}

// CUE returns the cue.Value representing the actual schema.
func (gvs *genericVersionedSchema) CUE() cue.Value {
	return gvs.actual
}

// Version reports the major and minor versions of the schema.
func (gvs *genericVersionedSchema) Version() (major int, minor int) {
	return gvs.major, gvs.minor
}

// Returns the next VersionedCueSchema
func (gvs *genericVersionedSchema) Successor() schema.VersionedCueSchema {
	return gvs.next
}

// Migrate transforms a resource into a new Resource that is correct with
// respect to its Successor schema.
func (gvs *genericVersionedSchema) Migrate(x schema.Resource) (schema.Resource, schema.VersionedCueSchema, error) { // TODO restrict input/return type to concrete
	r, sch, err := gvs.migration(x.Value)
	if err != nil || sch == nil {
		r = x.Value.(cue.Value)
	}

	return schema.Resource{Value: r}, sch, nil
}

type migrationFunc func(x interface{}) (cue.Value, schema.VersionedCueSchema, error)

var terminalMigrationFunc = func(x interface{}) (cue.Value, schema.VersionedCueSchema, error) {
	// TODO send back the input
	return cue.Value{}, nil, nil
}

// panic if called
var panicMigrationFunc = func(x interface{}) (cue.Value, schema.VersionedCueSchema, error) {
	panic("migrations are not yet implemented")
}

// Creates a func to perform a "migration" that simply unifies the input
// artifact (which is expected to have already have been validated against an
// earlier schema) with a later schema.
func implicitMigration(v cue.Value, next schema.VersionedCueSchema) migrationFunc {
	return func(x interface{}) (cue.Value, schema.VersionedCueSchema, error) {
		w := v.Fill(x)
		// TODO is it possible that migration would be successful, but there
		// still exists some error here? Need to better understand internal CUE
		// erroring rules? seems like incomplete cue.Value may always an Err()?
		//
		// TODO should check concreteness here? Or can we guarantee a priori it
		// can be made concrete simply by looking at the schema, before
		// implicitMigration() is called to create this function?
		if w.Err() != nil {
			return w, nil, w.Err()
		}
		return w, next, w.Err()
	}
}

func buildSchemaFamily(famval cue.Value) (*schema.Family, error) {
	// TODO verify subsumption by #Family; renders many
	// error checks below unnecessary
	majiter, err := famval.Lookup("lineages").List()
	if err != nil {
		return nil, err
	}
	var major int
	var lastgvs *genericVersionedSchema
	fam := &schema.Family{}
	for majiter.Next() {
		var minor int
		miniter, _ := majiter.Value().List()
		var seq schema.Seq
		for miniter.Next() {
			gvs := &genericVersionedSchema{
				actual: miniter.Value(),
				major:  major,
				minor:  minor,
				// This gets overwritten on all but the very final schema
				migration: terminalMigrationFunc,
			}

			if minor != 0 {
				lastgvs.next = gvs
				// TODO Verify that this schema is backwards compat with prior.
				// Create an implicit migration operation on the prior schema.
				lastgvs.migration = implicitMigration(gvs.actual, gvs)
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
			seq = append(seq, gvs)
			minor++
		}
		major++
		fam.Seqs = append(fam.Seqs, seq)
	}

	// TODO stupid pointers not being references, fixme
	for o, seq := range fam.Seqs {
		for i, gen := range seq {
			var next *genericVersionedSchema
			if len(seq) == i+1 {
				if len(fam.Seqs) == o+1 {
					continue
				}
				next = fam.Seqs[o+1][0].(*genericVersionedSchema)
			} else {
				next = seq[i+1].(*genericVersionedSchema)
			}
			gvs := gen.(*genericVersionedSchema)
			gvs.next = next
			fam.Seqs[o][i] = gvs
		}
	}

	return fam, nil
}
