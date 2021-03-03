package load

import (
	"cuelang.org/go/cue/load"
	"github.com/grafana/grafana/pkg/schema"
)

// DashboardLoadPaths contains the configuration for loading a UniversalDashboard
//
// TODO it would probably be best to implement these with the new Go 1.16 io.fs
// virtual filesystem, as it would make it easy to embed the relevant .cue files.
// That may be impossible unless/until CUE's SDK (in particular
// load.Instances()) changes its API to accept io.fs, as well. Also, Grafana will
// need to update to 1.16.
type DashboardLoadPaths struct {
	// GrafanaCueRoot should point to a directory containing the filesystem layout
	// expected to exist at github.com/grafana/grafana/cue.
	GrafanaCueRoot string
}

// LoadUniversalDashboard creates a schema.Family that correponds to all known
// core-only dashboard schemata in this version of Grafana.
func LoadUniversalDashboard(p DashboardLoadPaths) (schema.Family, error) {
	// TODO deal with making sure we're using the same cue.Runtime everywhere

	// The universal dashboard is comprised of the set of schemas that
	l := load.Instances([]string{p.GrafanaCueRoot + "/cue/data"}, &load.Config{Package: "grafanaschema"})
	if err != nil {
		return nil, err
	}

	// Select the dashboard schema Value from the instance path at which we have
	// defined it to live.
	// TODO ugh, we need to fully define the schema family pattern to pull out the current dashboard
	dashv := l.Lookup("#Dashboard")
}

// TODO how are we gonna handle nested things (dashboards and panels) that are independently versioned?

func LoadLocalDashboard(p DashboardLoadPaths) (schema.Family, error) {
}

// ---
// RANDOM NOTES ABOUT PAINFUL SHIT

// There will exist cases where artifacts that are valid with respect to an
// on-seq schema will have problems migrating to the next schema, whether or not
// it's in the next seq. This is particularly likely to occur if a schema has
// been underspecified - as we expect many initially will - and the author wants
// to get more precise in subsequent schema versions.
//
// For example, say an author initially specifies a particular sub-field
// in their schema to be "{}", meaning that any struct/object will unify and
// therefore pass validation.
//
// schema1: {
//   subfield: {}
// }
//
// Then, say a subsequent version of the same schema adds required fields to
// that formerly-empty subfield, including default values (as required by backwards
// compatibility rules).
//
// schema2: {
//   subfield: {
//     foo: string | *"ohai"
//   }
// }
//
// Such field additions aren't *necessarily* a problem. But if a) the new
// schema's added fields actually did existed in artifacts that were valid for
// previous versions of the schema, and b) there was variation in the naming or
// structure of those fields that was previously handled by frontend migration
// logic, then the new version of the schema can capture at most one of those
// variations. If a variation not covered by the schema is encountered, it will
// pass validation thanks to the new field's default value, but the user will
// consider it to be erroneous, as default values will have been applied where
// user intent "should" have been honored.
//
// artifacts2: {
//   subfield: {
//     bar: "ohai" // the contents of bar should properly be writen in foo
//   }
// }
//
// There isn't really a lot we can do about this within the bounds of this
// system. Designing even more intermediate structures would be really complex.
// It's best to accept this as a limitation entailed by CUE's fundamental
// constraints, and lean on docs and education to help avoid authors from
// creating such situations in the first place.

// When creating schema, it's easiest to express conditionally required fields
// by encapsulating the interrelated fields within its own struct. This way,
// the overall field can be made optional, but if present, its subfields may be
// required.
//
// Even this strategy doesn't scale terribly well, though. Where possible, one
// should avoid creating large, deeply nested conditional structures by instead
// erring on the side of making a conditional field required and giving it a
// default value, then ensuring that the mere presence of the field does not
// change behavior in consumers of the schema.
