package version

import (
	"fmt"
	"regexp"
	"strings"
)

// Constraint represents a single constraint for a version, such as
// ">= 1.0".
type Constraint struct {
	f        constraintFunc
	check    *Version
	original string
}

// Constraints is a slice of constraints. We make a custom type so that
// we can add methods to it.
type Constraints []*Constraint

type constraintFunc func(v, c *Version) bool

var constraintOperators map[string]constraintFunc

var constraintRegexp *regexp.Regexp

func init() {
	constraintOperators = map[string]constraintFunc{
		"":   constraintEqual,
		"=":  constraintEqual,
		"!=": constraintNotEqual,
		">":  constraintGreaterThan,
		"<":  constraintLessThan,
		">=": constraintGreaterThanEqual,
		"<=": constraintLessThanEqual,
		"~>": constraintPessimistic,
	}

	ops := make([]string, 0, len(constraintOperators))
	for k, _ := range constraintOperators {
		ops = append(ops, regexp.QuoteMeta(k))
	}

	constraintRegexp = regexp.MustCompile(fmt.Sprintf(
		`^\s*(%s)\s*(%s)\s*$`,
		strings.Join(ops, "|"),
		VersionRegexpRaw))
}

// NewConstraint will parse one or more constraints from the given
// constraint string. The string must be a comma-separated list of
// constraints.
func NewConstraint(v string) (Constraints, error) {
	vs := strings.Split(v, ",")
	result := make([]*Constraint, len(vs))
	for i, single := range vs {
		c, err := parseSingle(single)
		if err != nil {
			return nil, err
		}

		result[i] = c
	}

	return Constraints(result), nil
}

// Check tests if a version satisfies all the constraints.
func (cs Constraints) Check(v *Version) bool {
	for _, c := range cs {
		if !c.Check(v) {
			return false
		}
	}

	return true
}

// Returns the string format of the constraints
func (cs Constraints) String() string {
	csStr := make([]string, len(cs))
	for i, c := range cs {
		csStr[i] = c.String()
	}

	return strings.Join(csStr, ",")
}

// Check tests if a constraint is validated by the given version.
func (c *Constraint) Check(v *Version) bool {
	return c.f(v, c.check)
}

func (c *Constraint) String() string {
	return c.original
}

func parseSingle(v string) (*Constraint, error) {
	matches := constraintRegexp.FindStringSubmatch(v)
	if matches == nil {
		return nil, fmt.Errorf("Malformed constraint: %s", v)
	}

	check, err := NewVersion(matches[2])
	if err != nil {
		return nil, err
	}

	return &Constraint{
		f:        constraintOperators[matches[1]],
		check:    check,
		original: v,
	}, nil
}

//-------------------------------------------------------------------
// Constraint functions
//-------------------------------------------------------------------

func constraintEqual(v, c *Version) bool {
	return v.Equal(c)
}

func constraintNotEqual(v, c *Version) bool {
	return !v.Equal(c)
}

func constraintGreaterThan(v, c *Version) bool {
	return v.Compare(c) == 1
}

func constraintLessThan(v, c *Version) bool {
	return v.Compare(c) == -1
}

func constraintGreaterThanEqual(v, c *Version) bool {
	return v.Compare(c) >= 0
}

func constraintLessThanEqual(v, c *Version) bool {
	return v.Compare(c) <= 0
}

func constraintPessimistic(v, c *Version) bool {
	if v.LessThan(c) {
		return false
	}

	for i := 0; i < c.si-1; i++ {
		if v.segments[i] != c.segments[i] {
			return false
		}
	}

	return true
}
