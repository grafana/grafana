package load

import (
	"bytes"
	"fmt"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/load"
	cuejson "cuelang.org/go/pkg/encoding/json"
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
		// TODO Semantics of loading instances is quite confusing. This 'Dir'
		// field is a case in point. It must be set to "/" in order for the
		// overlay to be searched and have all files loaded in the cue/scuemata
		// directory. (This isn't necessary when loading individual .cue files.)
		// But anchoring a search at root seems like we're begging for
		// vulnerabilities where Grafana can read and print out anything on the
		// filesystem, which can be a disclosure problem, unless we're
		// absolutely sure the search is within a virtual filesystem. Which i'm
		// not.
		//
		// And no, changing the toOverlay() to have a subpath and the
		// load.Instances to mirror that subpath does not allow us to get rid of
		// this "/".
		Dir: "/",
	}
	return rt.Build(load.Instances([]string{"/grafana/cue/scuemata"}, cfg)[0])
}

func buildGenericScuemata(famval cue.Value) (schema.VersionedCueSchema, error) {
	// TODO verify subsumption by #Family; renders many
	// error checks below unnecessary
	majiter, err := famval.LookupPath(cue.MakePath(cue.Str("lineages"))).List()
	if err != nil {
		return nil, err
	}

	var major int
	var first, lastgvs *genericVersionedSchema
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
				first = gvs
			}
			lastgvs = gvs
			minor++
		}
		major++
	}

	return first, nil
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
func (gvs *genericVersionedSchema) ApplyDefaults(r schema.Resource) (schema.Resource, error) {
	rv, err := rt.Compile("resource", r.Value)
	if err != nil {
		return r, err
	}
	rvUnified := rv.Value().Unify(gvs.CUE())
	re, err := convertCUEValueToString(rvUnified)
	if err != nil {
		return r, err
	}
	return schema.Resource{Value: re}, nil
}

func convertCUEValueToString(inputCUE cue.Value) (string, error) {
	re, err := cuejson.Marshal(inputCUE)
	if err != nil {
		return re, err
	}

	result := []byte(re)
	result = bytes.Replace(result, []byte("\\u003c"), []byte("<"), -1)
	result = bytes.Replace(result, []byte("\\u003e"), []byte(">"), -1)
	result = bytes.Replace(result, []byte("\\u0026"), []byte("&"), -1)
	return string(result), nil
}

// TrimDefaults returns a new, concrete copy of the Resource where all paths
// in the  where the values at those paths are the same as the default value
// given in the schema.
func (gvs *genericVersionedSchema) TrimDefaults(r schema.Resource) (schema.Resource, error) {
	rvInstance, err := rt.Compile("resource", r.Value)
	if err != nil {
		return r, err
	}
	rv, _, err := removeDefaultHelper(gvs.CUE(), rvInstance.Value())
	if err != nil {
		return r, err
	}
	re, err := convertCUEValueToString(rv)
	if err != nil {
		return r, err
	}
	return schema.Resource{Value: re}, nil
}

func removeDefaultHelper(inputdef cue.Value, input cue.Value) (cue.Value, bool, error) {
	// Since for now, panel definition is open validation,
	// we need to loop on the input CUE for trimming
	rvInstance, err := rt.Compile("resource", []byte{})
	if err != nil {
		return input, false, err
	}
	rv := rvInstance.Value()

	fmt.Println("xxxxxxxxxxxxxxxxxxxxx", inputdef.IncompleteKind())
	switch inputdef.IncompleteKind() {
	case cue.StructKind:
		// Get all fields including optional fields
		iter, err := inputdef.Fields(cue.All())
		if err != nil {
			return rv, false, err
		}
		for iter.Next() {
			lable, _ := iter.Value().Label()
			Vinfo, err := input.FieldByName(lable, false)
			if err != nil {
				continue
			}
			lv := Vinfo.Value
			fmt.Printf(">>>>> the pathhhhhhhhhhh        %+v          \n", iter.Value().Path())
			if lv.Exists() {
				re, isEqual, err := removeDefaultHelper(iter.Value(), lv)
				if err == nil && !isEqual {
					fmt.Println("I am filling the path with ", iter.Value().Path())
					rv = rv.FillPath(cue.MakePath(cue.Str(lable)), re)
				}
			}
		}
		return rv, false, nil
	case cue.ListKind:
		fmt.Println("xxxxxxxxxxxxxxxxxxxxx")
		val, _ := inputdef.Default()
		err1 := input.Subsume(val)
		err2 := val.Subsume(input)
		if val.IsConcrete() && err1 == nil && err2 == nil {
			return rv, true, nil
		}

		lable, _ := inputdef.Label()

		// _, exi := inputdef.Elem()
		// if !exi {
		// 	return rv, true, nil
		// }

		// iter, err := input.List()
		// if err != nil {
		// 	return rv, true, nil
		// }
		// for iter.Next() {
		// fmt.Println("xxxxxxxxxxxxxxxxxxxxx", interval.IncompleteKind())
		// 	// re, isEqual, err := removeDefaultHelper(ele, iter.Value())
		// 	// if err == nil && !isEqual {
		// 	// 	fmt.Println("I am filling the path with ", iter.Value().Path())
		// 	// 	rv = append(rv, re)
		// 	// }
		// }

		rv = rv.FillPath(cue.Path(cue.MakePath(cue.Str(lable))), input)
		return rv, false, nil
	default:
		val, _ := inputdef.Default()
		// a, _ := val.String()
		// b, _ := input.String()
		// fmt.Println("<<<<<<<<<<<<<<<<< val: ", a, " <<<<<<<<<<< input: ", b, "equal result: ", val.Equals(input))
		err1 := input.Subsume(val)
		err2 := val.Subsume(input)
		if val.IsConcrete() && err1 == nil && err2 == nil {
			return input, true, nil
		}
		return input, false, nil
	}
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
	if gvs.next == nil {
		// Untyped nil, allows `<sch> == nil` checks to work as people expect
		return nil
	}
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
// var panicMigrationFunc = func(x interface{}) (cue.Value, schema.VersionedCueSchema, error) {
// 	panic("migrations are not yet implemented")
// }

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
