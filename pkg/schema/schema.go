package schema

import "cuelang.org/go/cue"

// Shared cue.Runtime that all relevant operations reuse.
//
// CUE requires that instances and values come from the same Runtime if they are
// to interact with each others' methods. Failure to do so leads to panics.
//
// TODO figure out how we keep everything using the same cue.Runtime
var rt *cue.Runtime

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

// Validate checks that each member of the Seq is (backwards) compatible with
// its predecessor.
func (s Seq) Validate() error {
	// TODO Check that each schema in the sequence unifies with its predecessor,
	// when the successor schema is closed and

	// TODO semver-style thinking would entail that something can sit on v0
	// through breaking changes
	return nil
}

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

	// Migrate transforms an Resource into a new Resource that is correct with
	// respect to its Successor schema.
	Migrate(Resource) (Resource, bool, error)

	// Successor returns the CueSchema to which this CueSchema knows how to
	// migrate, if any.
	Successor() CueSchema

	// Actual returns the cue.Value representing the actual schema.
	Actual() cue.Value
}

// VersionedCueSchema are CueSchema that are part of a backwards-compatible
// versioned Seq.
type VersionedCueSchema interface {
	CueSchema

	// Version reports the major and minor versions of the schema.
	Version() (major, minor int)

	// Returns the next VersionedCueSchema
	Next() VersionedCueSchema
}

// Validate checks the provided Resource against all CueSchema known
// to the Family, stopping as soon as one succeeds. The first schema
// that successfully validates is returned.
//
// For resource artifacts that contain proper schema version information,
// this operation is essentially O(1) - we can sniff the schema to
//
// TODO we need a general CUE definition of versioning schema, and a pattern for
// how it must appear in a resource. This is especially important/difficult for
// nested objects.
//
// Additional CueSchema may be provided to check for validation.
func (f *Family) Validate(r Resource, s ...CueSchema) (CueSchema, error) {
	return nil, nil
}

// A Resource represents a concrete configuration object - e.g., JSON
// representing a dashboard.
//
// This type mostly exists to improve readability for users - having a type that
// differentiates schema cue.Value from resource cue.Value is handy. It also
// gives us a working type for a resource that can be reused across multiple
// calls, so that re-parsing isn't necessary.
type Resource struct {
	Value cue.Value
}

// Indicates that an resource has indicated it is created from a schema version
// that is newer than what the Family is aware of.
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
