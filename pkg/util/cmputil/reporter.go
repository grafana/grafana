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
		if strings.HasPrefix(path, diff.Path) {
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

type Diff struct {
	// Path to the field that has difference separated by period. Array index and key are designated by square brackets.
	// For example, Annotations[12345].Data.Fields[0].ID
	Path  string
	Left  reflect.Value
	Right reflect.Value
}

func (d *Diff) String() string {
	left := d.Left.String()
	// invalid reflect.Value is produced when two collections (slices\maps) are compared and one misses value.
	// This way go-cmp indicates that an element was added\removed from a list.
	if !d.Left.IsValid() {
		left = "<none>"
	}
	right := d.Right.String()
	if !d.Right.IsValid() {
		right = "<none>"
	}
	return fmt.Sprintf("%v:\n\t-: %+v\n\t+: %+v", d.Path, left, right)
}
