package schema

import (
	"errors"
	"fmt"
	"math/bits"
	"reflect"

	"cuelang.org/go/cue"
)

// A Family is the identifier for a group of related schemas that all specify a
// single kind of object - e.g., a dashboard.
//
// Versioned schemas are numbered with a major and a minor version. (This is NOT
// semver!) All schemas in a family with the same major version are kept in an
// ordered sequence, with the invariant that all later versions are backwards
// compatible with all earlier versions, following CUE's definition of
// compatibility. Major versions are also referred to as "trains," as resources
// can "ride the train" from any minor/patch version forward to the latest
// version.
//
// schemas. with the invariant that all later schemas
type Family struct {
	Seqs []Seq
}

type Fam interface {
	Validate(r Resource) (VersionedCueSchema, error)

	// Returns the first VersionedCueSchema in the family.
	//
	// All other schema versions may be accessed through repeated calls
	// to VersionedCueSchema.Successor(), or through convenience helper
	// functions.
	First() VersionedCueSchema
}

// Find looks through the linked series to find a particular schema based on
// version position properties.
func Find(vcs VersionedCueSchema, opt SearchOption) (VersionedCueSchema, error) {
	panic("not implemented yet")
}

// AsArray collates all VersionedCueSchema in a Family into a two-dimensional
// array. The outer array index corresponds to major version number and inner
// array index to minor version number.
func AsArray(f Fam) [][]VersionedCueSchema {
	var ret [][]VersionedCueSchema
	var flat []VersionedCueSchema

	cur := f.First()
	// TODO lol, be better
	for !reflect.ValueOf(cur).IsNil() {
		flat = append(flat, cur)
		cur = cur.Successor()
	}

	for _, sch := range flat {
		maj, _ := sch.Version()
		if len(ret) == maj {
			ret = append(ret, []VersionedCueSchema{})
		}
		ret[maj] = append(ret[maj], sch)
	}

	return ret
}

// SearchOption indicates how far along a chain of schemas an operation should
// proceed.
type SearchOption sso

type sso func(p *ssopt)

type ssopt struct {
	latest               bool
	latestInMajor        int
	hasLatestInMajor     bool
	latestInCurrentMajor bool
	exact                [2]int
}

func (p *ssopt) validate() error {
	var which uint16
	if p.latest {
		which = which + 1<<1
	}
	if p.exact != [2]int{0, 0} {
		which = which + 1<<2
	}
	if p.hasLatestInMajor {
		if p.latestInMajor != -1 {
			which = which + 1<<3
		}
	} else if p.latestInMajor != 0 {
		// Disambiguate real zero from default zero
		return fmt.Errorf("latestInMajor should never be non-zero if hasLatestInMajor is false, got %v", p.latestInMajor)
	}
	if p.latestInCurrentMajor {
		which = which + 1<<4
	}

	if bits.OnesCount16(which) != 1 {
		return errors.New("may only pass one SchemaSearchOption")
	}
	return nil
}

// Latest will find the absolute most recent schema.
func Latest() SearchOption {
	return func(p *ssopt) {
		p.latest = true
	}
}

// LatestInMajor will find the latest schema within the given major version
// sequence.
func LatestInMajor(maj int) SearchOption {
	return func(p *ssopt) {
		p.latestInMajor = maj
	}
}

// LatestInCurrentMajor will find the latest schema within the current major
// version from which the search begins.
//
// If seeking over a Family rather than an individual VersionedCueSchema, this is
// equivalent to LatestInMajor(0). It is a no-op on plain CueSchema.
func LatestInCurrentMajor() SearchOption {
	return func(p *ssopt) {
		p.latestInCurrentMajor = true
	}
}

// Exact will find the schema with the exact major and minor version number
// provided.
func Exact(maj, min int) SearchOption {
	return func(p *ssopt) {
		p.exact = [2]int{maj, min}
	}
}

// Seq is an ordered list of schemas, with the intended invariant that each
// schema in the sequence is backwards compatible with its predecessor.
//
// It is incumbent on the creator of the Seq to ensure that this invariant is
// maintained at the time the Seq is created.
type Seq []VersionedCueSchema

// CueSchema represents a single, complete CUE-based schema that can perform
// operations on Resources.
//
// All CueSchema MUST EITHER:
//  - Be a VersionedCueSchema, and be the latest version in the latest Seq in a Family
//  - Define a Successor(), and a procedure to Migrate() a Resource to that successor
//
// By definition, VersionedCueSchema within are within a Seq. As long as Seq
// backwards compatibility invariants hold, migration to a VersionedCueSchema to
// a successor schema in their Seq is trivial: simply unify the Resource with
// the successor schema.
//
// A standard pattern to define schema and their migrations to successor schema
// in .cue files is given in the load package, and codified into its functions.
// (TODO this needs to actually be hammered out!)
type CueSchema interface {
	// Validate checks that the resource is correct with respect to the schema.
	Validate(Resource) error

	// ApplyDefaults returns a new, concrete copy of the Resource with all paths
	// that are 1) missing in the Resource AND 2) specified by the schema,
	// filled with default values specified by the schema.
	ApplyDefaults(Resource) (Resource, error)

	// TrimDefaults returns a new, concrete copy of the Resource where all paths
	// in the  where the values at those paths are the same as the default value
	// given in the schema.
	TrimDefaults(Resource) (Resource, error)

	// Migrate transforms a Resource into a new Resource that is correct with
	// respect to its Successor schema. It returns the transformed resource,
	// the schema to which the resource now conforms, and any errors that
	// may have occurred during the migration.
	//
	// No migration occurs and the input Resource is returned in two cases:
	//
	//   - The migration encountered an error; the third return is non-nil.
	//   - There exists no schema to migrate to; the second and third return are nil.
	//
	// Note that the returned schema is always a VersionedCueSchema. This
	// reflects a key design invariant of the system: all migrations, whether
	// they begin from a schema inside or outside of the Family, must land
	// somewhere on a Family's sequence of schemata.
	Migrate(Resource) (Resource, VersionedCueSchema, error)

	// Successor returns the CueSchema to which this CueSchema can migrate a
	// Resource. If there is no successor schema, the second return value is
	// false.
	Successor() VersionedCueSchema
	// TODO
	// Successor() (VersionedCueSchema, bool)

	// CUE returns the cue.Value representing the actual schema.
	CUE() cue.Value
}

// VersionedCueSchema are CueSchema that are part of a backwards-compatible
// versioned Seq.
type VersionedCueSchema interface {
	CueSchema

	// Version reports the major and minor versions of the schema.
	Version() (major, minor int)
}

// Validate checks the provided Resource against all CueSchema known
// to the Family, stopping as soon as one succeeds. The first schema
// that successfully validates is returned.
//
// For resource artifacts that contain proper schema version information, this
// operation is essentially O(1) - we can sniff schema version information from
// the artifact to determine the exact schema to check against.
//
// TODO we need a general CUE definition of versioning schema, and a pattern for
// how it must appear in a resource. This is especially important/difficult for
// nested objects.
//
// Additional CueSchema may be provided to check for validation.
func (f *Family) Validate(r Resource, s ...CueSchema) (CueSchema, error) {
	// Work from latest to earliest
	var err error
	for o := len(f.Seqs) - 1; o >= 0; o-- {
		for i := len(f.Seqs[o]) - 1; i >= 0; i-- {
			if err = f.Seqs[o][i].Validate(r); err == nil {
				return f.Seqs[o][i], nil
			}
		}
	}
	// TODO sloppy, return more than last error
	return nil, err
}

// A Resource represents a concrete data object - e.g., JSON
// representing a dashboard.
//
// This type mostly exists to improve readability for users. Having a type that
// differentiates cue.Value that represent a schema from cue.Value that
// represent a concrete object is quite helpful. It also gives us a working type
// for a resource that can be reused across multiple calls, so that re-parsing
// isn't necessary.
type Resource struct {
	Value interface{}
}

type ValidatedResource interface {
	Schema() CueSchema
	Migrate()
}

// TooNewError indicates that a resource was created from a newer schema version
// than the Family is aware exists.
//
// This situation is only really a problem if the resource contains fields that
// were defined in the newer version of the schema, causing it to fail validation
// against a strict/closed interpretation of earlier schema.
// type TooNewError struct {
// }
