package schema

import (
	"errors"
	"fmt"
	"math/bits"

	"cuelang.org/go/cue"
)

// CueSchema represents a single, complete CUE-based schema that can perform
// operations on Resources.
//
// All CueSchema MUST EITHER:
//  - Be a VersionedCueSchema, and be the latest version in the latest lineage in a Family
//  - Return non-nil from Successor(), and a procedure to Migrate() a Resource to that successor schema
//
// By definition, VersionedCueSchema are within a lineage. As long as lineage
// backwards compatibility invariants hold, migration to a VersionedCueSchema to
// a successor schema in their lineage is trivial: simply unify the Resource
// with the successor schema.
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

	// Successor returns the VersionedCueSchema to which this CueSchema can migrate a
	// Resource.
	Successor() VersionedCueSchema

	// CUE returns the cue.Value representing the actual schema.
	CUE() cue.Value
}

// VersionedCueSchema are CueSchema that are part of a backwards-compatible
// versioned lineage.
type VersionedCueSchema interface {
	CueSchema

	// Version reports the major and minor versions of the schema.
	Version() (major, minor int)
}

// SearchAndValidate traverses the family of schemas reachable from the provided
// VersionedCueSchema. For each schema, it attempts to validate the provided
// value, which may be a byte slice representing valid JSON (TODO YAML), a Go
// struct, or cue.Value. If providing a cue.Value that is not fully concrete,
// the result is undefined.
//
// Traversal is performed from the newest schema to the oldest. However, because
// newer VersionedCueSchema have no way of directly accessing their predecessors
// (they form a singly-linked list), the oldest possible schema should always be
// provided - typically, the one returned from the family loader function.
//
// Failure to validate against any schema in the family is indicated by a
// non-nil error return. Success is indicated by a non-nil VersionedCueSchema.
// If successful, the returned VersionedCueSchema will be the first one against
// which the provided resource passed validation.
func SearchAndValidate(s VersionedCueSchema, v interface{}) (VersionedCueSchema, error) {
	arr := AsArray(s)

	// Work from latest to earliest
	var err error
	for o := len(arr) - 1; o >= 0; o-- {
		for i := len(arr[o]) - 1; i >= 0; i-- {
			if err = arr[o][i].Validate(Resource{Value: v}); err == nil {
				return arr[o][i], nil
			}
		}
	}

	// TODO sloppy, return more than last error. Need our own error type that
	// collates all the individual errors, relates them to the schema that
	// produced them, and ideally deduplicates repeated errors across each
	// schema.
	return nil, err
}

// AsArray collates all VersionedCueSchema in a Family into a two-dimensional
// array. The outer array index corresponds to major version number and inner
// array index to minor version number.
func AsArray(sch VersionedCueSchema) [][]VersionedCueSchema {
	var ret [][]VersionedCueSchema
	var flat []VersionedCueSchema

	// two loops. lazy day, today
	for sch != nil {
		flat = append(flat, sch)
		sch = sch.Successor()
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

// Find traverses the chain of VersionedCueSchema until the criteria in the
// SearchOption is met.
//
// If no schema is found that fulfills the criteria, nil is returned. Latest()
// and LatestInCurrentMajor() will always succeed, unless the input schema is
// nil.
func Find(s VersionedCueSchema, opt SearchOption) VersionedCueSchema {
	if s == nil {
		return nil
	}

	p := &ssopt{}
	opt(p)
	if err := p.validate(); err != nil {
		panic(fmt.Sprint("unreachable:", err))
	}

	switch {
	case p.latest:
		for ; s.Successor() != nil; s = s.Successor() {
		}
		return s

	case p.latestInCurrentMajor:
		p.latestInMajor, _ = s.Version()
		fallthrough

	case p.hasLatestInMajor:
		imaj, _ := s.Version()
		if imaj > p.latestInMajor {
			return nil
		}

		var last VersionedCueSchema
		for imaj <= p.latestInMajor {
			last, s = s, s.Successor()
			if s == nil {
				if imaj == p.latestInMajor {
					return last
				}
				return nil
			}

			imaj, _ = s.Version()
		}
		return last

	default: // exact
		for s != nil {
			maj, min := s.Version()
			if p.exact == [2]int{maj, min} {
				return s
			}
			s = s.Successor()
		}
		return nil
	}
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

// Latest indicates that traversal will continue to the newest schema in the
// newest lineage.
func Latest() SearchOption {
	return func(p *ssopt) {
		p.latest = true
	}
}

// LatestInMajor will find the latest schema within the provided major version
// lineage. If no lineage exists corresponding to the provided number, traversal
// will terminate with an error.
func LatestInMajor(maj int) SearchOption {
	return func(p *ssopt) {
		p.latestInMajor = maj
	}
}

// LatestInCurrentMajor will find the newest schema having the same major
// version as the schema from which the search begins.
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

// A Resource represents a concrete data object - e.g., JSON
// representing a dashboard.
//
// This type mostly exists to improve readability for users. Having a type that
// differentiates cue.Value that represent a schema from cue.Value that
// represent a concrete object is quite helpful. It also gives us a working type
// for a resource that can be reused across multiple calls, so that re-parsing
// isn't necessary.
//
// TODO this is a terrible way to do this, refactor
type Resource struct {
	Value interface{}
}

// TODO add migrator with SearchOption for stopping criteria
