package cmputil

import (
	"fmt"
	"reflect"
	"strings"

	"github.com/google/go-cmp/cmp"
)

type DiffReport []Diff

// GetDiffsForField returns subset of the diffs which path starts with the provided path
func (r DiffReport) GetDiffsForField(path string) DiffReport {
	var result []Diff
	for _, diff := range r {
		if strings.HasPrefix(diff.Path, path) {
			if diff.Path != path {
				char := []rune(diff.Path)[len(path)]
				if char != '.' && char != '[' { // if the following symbol is not a delimiter or bracket then that's not our path
					continue
				}
			}
			result = append(result, diff)
		}
	}
	return result
}

// DiffReporter is a simple custom reporter that only records differences
// detected during comparison. Implements an interface required by cmp.Reporter option
type DiffReporter struct {
	path  cmp.Path
	Diffs DiffReport
}

func (r *DiffReporter) PushStep(ps cmp.PathStep) {
	r.path = append(r.path, ps)
}

func (r *DiffReporter) PopStep() {
	r.path = r.path[:len(r.path)-1]
}

func (r *DiffReporter) Report(rs cmp.Result) {
	if !rs.Equal() {
		vx, vy := r.path.Last().Values()
		r.Diffs = append(r.Diffs, Diff{
			Path:  printPath(r.path),
			Left:  vx,
			Right: vy,
		})
	}
}

func printPath(p cmp.Path) string {
	ss := strings.Builder{}
	for _, s := range p {
		toAdd := ""
		switch v := s.(type) {
		case cmp.StructField:
			toAdd = v.String()
		case cmp.MapIndex:
			toAdd = fmt.Sprintf("[%s]", v.Key())
		case cmp.SliceIndex:
			if v.Key() >= 0 {
				toAdd = fmt.Sprintf("[%d]", v.Key())
			}
		}
		if toAdd == "" {
			continue
		}
		ss.WriteString(toAdd)
	}
	return strings.TrimPrefix(ss.String(), ".")
}

func (r DiffReport) String() string {
	b := strings.Builder{}
	for _, diff := range r {
		b.WriteString(diff.String())
		b.WriteByte('\n')
	}
	return b.String()
}

// Paths returns the slice of paths of the current DiffReport
func (r DiffReport) Paths() []string {
	var result = make([]string, 0, len(r))
	for _, diff := range r {
		result = append(result, diff.Path)
	}
	return result
}

type Diff struct {
	// Path to the field that has difference separated by period. Array index and key are designated by square brackets.
	// For example, Annotations[12345].Data.Fields[0].ID
	Path  string
	Left  reflect.Value
	Right reflect.Value
}

func (d *Diff) String() string {
	return fmt.Sprintf("%v:\n\t-: %+v\n\t+: %+v\n", d.Path, describeReflectValue(d.Left), describeReflectValue(d.Right))
}

func describeReflectValue(v reflect.Value) interface{} {
	// invalid reflect.Value is produced when two collections (slices\maps) are compared and one misses value.
	// This way go-cmp indicates that an element was added\removed from a list.
	if !v.IsValid() {
		return "<none>"
	}
	return v
}

// IsAddOperation returns true when
//   - Left does not have value and Right has
//   - the kind of Left and Right is either reflect.Slice or reflect.Map and the length of Left is less than length of Right
//
// In all other cases it returns false.
// NOTE: this is applicable to diff of Maps and Slices only
func (d *Diff) IsAddOperation() bool {
	return !d.Left.IsValid() && d.Right.IsValid() || (d.Left.Kind() == d.Right.Kind() && // cmp reports adding first element to a nil slice as creation of one and therefore Left is valid and it is nil and right is a new slice
		(d.Left.Kind() == reflect.Slice || d.Left.Kind() == reflect.Map) && d.Left.Len() < d.Right.Len())
}

// IsDeleteOperation returns true when
//   - Right does not have value and Left has
//   - the kind of Left and Right is either reflect.Slice or reflect.Map and the length of Right is less than length of Left
//
// In all other cases it returns false.
// NOTE: this is applicable to diff of Maps and Slices only
func (d *Diff) IsDeleteOperation() bool {
	return d.Left.IsValid() && !d.Right.IsValid() || (d.Left.Kind() == d.Right.Kind() &&
		(d.Left.Kind() == reflect.Slice || d.Left.Kind() == reflect.Map) && d.Left.Len() > d.Right.Len())
}
