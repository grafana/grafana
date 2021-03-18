package schema

import (
	"cuelang.org/go/cue"
)

// A Family is the identifier for a group of related schemas that all specify a
// single kind of object - e.g., a dashboard.
//
// Versioned schemas are numbered using semver (disallowing v0, build or
// prerelease - purely major, minor, patch). All schemas in a family with
// the same major version are kept in an ordered sequence, with the invariant
// that all later versions are backwards compatible with all earlier versions,
// following CUE's definition of compatibility. Major versions are also referred
// to as "trains," as resources can "ride the train" from any minor/patch
// version forward to the latest version.
//
// schemas. with the invariant that all later schemas
type Family struct {
	Seqs []Seq
}

// Seq is an ordered list of schemas, with the intended invariant that each
// schema in the sequence is backwards compatible with the previous.
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
// backwards compatibility invariants hold, migration to from a
// VersionedCueSchema to a successor schema in their Seq is trivial: simply unify
// the Resource with the successor schema.
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
	// Resource. Returns nil if no such schema exists.
	Successor() VersionedCueSchema

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

// TooNewError indicates that a resource was created from a newer schema version
// than the Family is aware.
//
// This situation is only really a problem if the resource contains fields that
// were defined in the newer version of the schema, causing it to fail validation
// against a strict/closed interpretation of earlier schema.
type TooNewError struct {
}

// TODO a buncha more standard errors are needed

// Flow:
//
// 1. Caller has some resource/JSON that they THINK is of a known family/kind.
//    (Yes, this covers everything. The existence of canonical schema/this package
//    entails that some JSON can only be called "a dashboard" if it conforms to
//    these schemas.)
// 2. Caller picks a family to validate against based on what kind of resource they
//    think they have, and how universally they want to/can validate, and attempts to
//    Validate. Validation will have a top-level method, also broken down into smaller methods.
// 3. Successful validation returns an Resource, failure an informative error. (Errors will
//    wrap lower-level errors, particularly CUE ones, to make sense, and will be specific
//    to each family.)
// 4. The Resource then has a few operations available:
//    - migrate to some newer schema, if a migration exists for its found schema
//    - strip defaults
//    - apply defaults
//    - marshal to concrete representation (JSON)

// To construct the set of builtin family objects, we need to provide concrete paths
// that correspond to certain known file locations. Not all of these concrete paths
// will be knowable, depending on the context in which this package is loaded. So,
// it's the sole responsibility of this package to define the mold into which
// we pour specific knowledge about a loaded filesystem. (We can't even
// enumerate those kinds here...we could try to break that with bindata, but
// that seems inadvisable.)
