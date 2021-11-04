package schema

import (
	"bytes"
	"errors"
	"fmt"
	"math/bits"

	"cuelang.org/go/cue"
	errs "cuelang.org/go/cue/errors"
	cuejson "cuelang.org/go/pkg/encoding/json"
)

// CueError wraps Errors caused by malformed cue files.
type CueError struct {
	ErrorMap map[int]string
}

// Error func needed to implement standard golang error
func (cErr *CueError) Error() string {
	var errorString string
	if cErr.ErrorMap != nil {
		for k, v := range cErr.ErrorMap {
			errorString = errorString + fmt.Sprintf("line: %d, %s \n", k, v)
		}
	}
	return errorString
}

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
	cueErrors := WrapCUEError(err)
	if err != nil {
		return nil, cueErrors
	}
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

// ApplyDefaults returns a new, concrete copy of the Resource with all paths
// that are 1) missing in the Resource AND 2) specified by the schema,
// filled with default values specified by the schema.
func ApplyDefaults(r Resource, scue cue.Value) (Resource, error) {
	name := r.Name
	if name == "" {
		name = "resource"
	}
	rv := scue.Context().CompileString(r.Value.(string), cue.Filename(name))
	if rv.Err() != nil {
		return r, rv.Err()
	}

	rvUnified, err := applyDefaultHelper(rv, scue)
	if err != nil {
		return r, err
	}

	re, err := convertCUEValueToString(rvUnified)
	if err != nil {
		return r, err
	}
	return Resource{Value: re}, nil
}

func applyDefaultHelper(input cue.Value, scue cue.Value) (cue.Value, error) {
	switch scue.IncompleteKind() {
	case cue.ListKind:
		// if list element exist
		ele := scue.LookupPath(cue.MakePath(cue.AnyIndex))

		// if input is not a concrete list, we must have list elements exist to be used to trim defaults
		if ele.Exists() {
			if ele.IncompleteKind() == cue.BottomKind {
				return input, errors.New("can't get the element of list")
			}
			iter, err := input.List()
			if err != nil {
				return input, errors.New("can't apply defaults for list")
			}
			var iterlist []cue.Value
			for iter.Next() {
				ref, err := getBranch(ele, iter.Value())
				if err != nil {
					return input, err
				}
				re, err := applyDefaultHelper(iter.Value(), ref)
				if err == nil {
					iterlist = append(iterlist, re)
				}
			}
			liInstance := scue.Context().NewList(iterlist...)
			if liInstance.Err() != nil {
				return input, liInstance.Err()
			}
			return liInstance, nil
		} else {
			return input.Unify(scue), nil
		}
	case cue.StructKind:
		iter, err := scue.Fields(cue.Optional(true))
		if err != nil {
			return input, err
		}
		for iter.Next() {
			lable, _ := iter.Value().Label()
			lv := input.LookupPath(cue.MakePath(cue.Str(lable)))
			if err != nil {
				continue
			}
			if lv.Exists() {
				res, err := applyDefaultHelper(lv, iter.Value())
				if err != nil {
					continue
				}
				input = input.FillPath(cue.MakePath(cue.Str(lable)), res)
			} else if !iter.IsOptional() {
				input = input.FillPath(cue.MakePath(cue.Str(lable)), iter.Value().Eval())
			}
		}
		return input, nil
	default:
		input = input.Unify(scue)
	}
	return input, nil
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
func TrimDefaults(r Resource, scue cue.Value) (Resource, error) {
	name := r.Name
	if name == "" {
		name = "resource"
	}
	rvInstance := scue.Context().CompileString(r.Value.(string), cue.Filename(name))
	if rvInstance.Err() != nil {
		return r, rvInstance.Err()
	}

	rv, _, err := removeDefaultHelper(scue, rvInstance)
	if err != nil {
		return r, err
	}
	re, err := convertCUEValueToString(rv)

	if err != nil {
		return r, err
	}
	return Resource{Value: re}, nil
}

func getDefault(icue cue.Value) (cue.Value, bool) {
	d, exist := icue.Default()
	if exist && d.Kind() == cue.ListKind {
		len, err := d.Len().Int64()
		if err != nil {
			return d, false
		}
		var defaultExist bool
		if len <= 0 {
			op, vals := icue.Expr()
			if op == cue.OrOp {
				for _, val := range vals {
					vallen, _ := val.Len().Int64()
					if val.Kind() == cue.ListKind && vallen <= 0 {
						defaultExist = true
						break
					}
				}
				if !defaultExist {
					exist = false
				}
			} else {
				exist = false
			}
		}
	}
	return d, exist
}

func isCueValueEqual(inputdef cue.Value, input cue.Value) bool {
	d, exist := getDefault(inputdef)
	if exist {
		return input.Subsume(d) == nil && d.Subsume(input) == nil
	}
	return false
}

func removeDefaultHelper(inputdef cue.Value, input cue.Value) (cue.Value, bool, error) {
	// To include all optional fields, we need to use inputdef for iteration,
	// since the lookuppath with optional field doesn't work very well
	rv := inputdef.Context().CompileString("", cue.Filename("helper"))
	if rv.Err() != nil {
		return input, false, rv.Err()
	}

	switch inputdef.IncompleteKind() {
	case cue.StructKind:
		// Get all fields including optional fields
		iter, err := inputdef.Fields(cue.Optional(true))
		if err != nil {
			return rv, false, err
		}
		keySet := make(map[string]bool)
		for iter.Next() {
			lable, _ := iter.Value().Label()
			keySet[lable] = true
			lv := input.LookupPath(cue.MakePath(cue.Str(lable)))
			if err != nil {
				return rv, false, err
			}
			if lv.Exists() {
				re, isEqual, err := removeDefaultHelper(iter.Value(), lv)
				if err == nil && !isEqual {
					rv = rv.FillPath(cue.MakePath(cue.Str(lable)), re)
				}
			}
		}
		// Get all the fields that are not defined in schema yet for panel
		iter, err = input.Fields()
		if err != nil {
			return rv, false, err
		}
		for iter.Next() {
			lable, _ := iter.Value().Label()
			if exists := keySet[lable]; !exists {
				rv = rv.FillPath(cue.MakePath(cue.Str(lable)), iter.Value())
			}
		}
		return rv, false, nil
	case cue.ListKind:
		if isCueValueEqual(inputdef, input) {
			return rv, true, nil
		}

		// take every element of the list
		ele := inputdef.LookupPath(cue.MakePath(cue.AnyIndex))

		// if input is not a concrete list, we must have list elements exist to be used to trim defaults
		if ele.Exists() {
			if ele.IncompleteKind() == cue.BottomKind {
				return rv, true, nil
			}

			iter, err := input.List()
			if err != nil {
				return rv, true, nil
			}
			var iterlist []cue.Value
			for iter.Next() {
				ref, err := getBranch(ele, iter.Value())
				if err != nil {
					iterlist = append(iterlist, iter.Value())
					continue
				}
				re, isEqual, err := removeDefaultHelper(ref, iter.Value())
				if err == nil && !isEqual {
					iterlist = append(iterlist, re)
				} else {
					iterlist = append(iterlist, iter.Value())
				}
			}
			liInstance := inputdef.Context().NewList(iterlist...)
			return liInstance, false, liInstance.Err()
		}
		// now when ele is empty, we don't trim anything
		return input, false, nil

	default:
		if isCueValueEqual(inputdef, input) {
			return input, true, nil
		}
		return input, false, nil
	}
}

func getBranch(schemaObj cue.Value, concretObj cue.Value) (cue.Value, error) {
	op, defs := schemaObj.Expr()
	if op == cue.OrOp {
		for _, def := range defs {
			err := def.Unify(concretObj).Validate(cue.Concrete(true))
			if err == nil {
				return def, nil
			}
		}
		// no matching branches? wtf
		return schemaObj, errors.New("no branch is found for list")
	}
	return schemaObj, nil
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
	Name  string
}

// WrapCUEError is a wrapper for cueErrors that occur and are not self explanatory.
// If an error is of type cueErr, then iterate through the error array, export line number
// and filename, otherwise return usual error.
func WrapCUEError(err error) error {
	var cErr errs.Error
	m := make(map[int]string)
	if ok := errors.As(err, &cErr); ok {
		for _, e := range errs.Errors(cErr) {
			if e.Position().File() != nil {
				line := e.Position().Line()
				m[line] = fmt.Sprintf("%q: in file %s", err, e.Position().File().Name())
			}
		}
	}
	if len(m) != 0 {
		return &CueError{m}
	}
	return err
}

// TODO add migrator with SearchOption for stopping criteria
