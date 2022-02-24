package cmputil

import (
	"fmt"
	"reflect"
	"strings"

	"github.com/google/go-cmp/cmp"
)

// DiffReport is a simple custom reporter that only records differences
// detected during comparison.
type DiffReport struct {
	path  cmp.Path
	Diffs []Diff
}

// GetDiffsForField returns subset of the diffs which path starts with the provided path
func (r *DiffReport) GetDiffsForField(path string) []Diff {
	var result []Diff
	for _, diff := range r.Diffs {
		if strings.HasPrefix(path, diff.Path) {
			result = append(result, diff)
		}
	}
	return result
}

func (r *DiffReport) PushStep(ps cmp.PathStep) {
	r.path = append(r.path, ps)
}

func (r *DiffReport) PopStep() {
	r.path = r.path[:len(r.path)-1]
}

func (r *DiffReport) Report(rs cmp.Result) {
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

func (r *DiffReport) String() string {
	b := strings.Builder{}
	for _, diff := range r.Diffs {
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
	if !d.Left.IsValid() {
		left = "<none>"
	}
	right := d.Right.String()
	if !d.Right.IsValid() {
		right = "<none>"
	}
	return fmt.Sprintf("%v:\n\t-: %+v\n\t+: %+v", d.Path, left, right)
}
