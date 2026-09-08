package search

import (
	"fmt"
	"reflect"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
)

// CUE-generated schemas must match the generic Go contract despite separate types.
func TestRequestBodyMatchesGenericSearchQuery(t *testing.T) {
	for name, generated := range map[string]any{
		"alert rules":     model.ListAlertRuleSearchRulesV0alpha1RequestBody{},
		"recording rules": model.ListRecordingRuleSearchRulesV0alpha1RequestBody{},
	} {
		t.Run(name, func(t *testing.T) {
			assertSameJSONShape(t, searchv0.SearchQuery{}, generated)
		})
	}
}

func TestResponseBodyMatchesGenericSearchResults(t *testing.T) {
	for name, generated := range map[string]any{
		"alert rules":     model.ListAlertRuleSearchRulesV0alpha1Response{},
		"recording rules": model.ListRecordingRuleSearchRulesV0alpha1Response{},
	} {
		t.Run(name, func(t *testing.T) {
			assertSameJSONShape(t, searchv0.SearchResults{}, generated)
		})
	}
}

func TestFilterOperatorsIncludeGenericAllOperator(t *testing.T) {
	assert.Equal(t, "All", string(model.ListAlertRuleSearchRulesV0alpha1RequestSearchFilterLeafOperatorAll))
	assert.Equal(t, "All", string(model.ListRecordingRuleSearchRulesV0alpha1RequestSearchFilterLeafOperatorAll))
}

func assertSameJSONShape(t *testing.T, want, got any) {
	t.Helper()
	for _, problem := range compareShapes(reflect.TypeOf(want), reflect.TypeOf(got), "") {
		t.Errorf("%s", problem)
	}
}

type typePair struct {
	want, got reflect.Type
}

func compareShapes(want, got reflect.Type, path string) []string {
	return compare(want, got, path, map[typePair]bool{})
}

func compare(want, got reflect.Type, path string, seen map[typePair]bool) []string {
	want, got = deref(want), deref(got)

	// Stop cycles in recursive where nodes without skipping sibling comparisons.
	pair := typePair{want: want, got: got}
	if seen[pair] {
		return nil
	}
	seen[pair] = true
	defer delete(seen, pair)

	if isOpenObject(want) || isOpenObject(got) {
		if !isOpenObject(want) || !isOpenObject(got) {
			return []string{fmt.Sprintf("%s: one side is an open object (%s) and the other is not (%s)", at(path), got, want)}
		}
		return nil
	}

	switch {
	case want.Kind() == reflect.Struct && got.Kind() == reflect.Struct:
		return compareStructs(want, got, path, seen)
	case want.Kind() == reflect.Slice && got.Kind() == reflect.Slice:
		return compare(want.Elem(), got.Elem(), path+"[]", seen)
	case want.Kind() == reflect.Map && got.Kind() == reflect.Map:
		if problems := compare(want.Key(), got.Key(), path+"{key}", seen); len(problems) > 0 {
			return problems
		}
		return compare(want.Elem(), got.Elem(), path+"{}", seen)
	}

	if jsonKind(want) != jsonKind(got) {
		return []string{fmt.Sprintf("%s: expected a JSON %s (%s) but the generated type is a JSON %s (%s)",
			at(path), jsonKind(want), want, jsonKind(got), got)}
	}
	return nil
}

func compareStructs(want, got reflect.Type, path string, seen map[typePair]bool) []string {
	wantFields, gotFields := jsonFields(want), jsonFields(got)

	problems := make([]string, 0, len(wantFields))
	for _, name := range missing(wantFields, gotFields) {
		problems = append(problems, fmt.Sprintf("%s: the generated type is missing %q, which the generic contract declares", at(path), name))
	}
	for _, name := range missing(gotFields, wantFields) {
		problems = append(problems, fmt.Sprintf("%s: the generated type declares %q, which the generic contract does not", at(path), name))
	}
	for _, name := range shared(wantFields, gotFields) {
		problems = append(problems, compare(wantFields[name], gotFields[name], join(path, name), seen)...)
	}
	return problems
}

func jsonFields(t reflect.Type) map[string]reflect.Type {
	out := map[string]reflect.Type{}
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		if !f.IsExported() {
			continue
		}
		tag := f.Tag.Get("json")
		name := strings.Split(tag, ",")[0]
		if f.Anonymous && (name == "" || strings.Contains(tag, "inline")) {
			for k, v := range jsonFields(deref(f.Type)) {
				out[k] = v
			}
			continue
		}
		if name == "-" || name == "" {
			continue
		}
		out[name] = f.Type
	}
	return out
}

func isOpenObject(t reflect.Type) bool {
	if t.Name() == "Unstructured" {
		return true
	}
	return t.Kind() == reflect.Map && t.Elem().Kind() == reflect.Interface
}

// Compare wire types, ignoring Go enum names and numeric representations.
func jsonKind(t reflect.Type) string {
	switch t.Kind() {
	case reflect.String:
		return "string"
	case reflect.Bool:
		return "boolean"
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64,
		reflect.Float32, reflect.Float64:
		return "number"
	case reflect.Slice, reflect.Array:
		return "array"
	case reflect.Map, reflect.Struct:
		return "object"
	default:
		return t.Kind().String()
	}
}

func deref(t reflect.Type) reflect.Type {
	for t.Kind() == reflect.Pointer {
		t = t.Elem()
	}
	return t
}

func missing(from, in map[string]reflect.Type) []string {
	var out []string
	for name := range from {
		if _, ok := in[name]; !ok {
			out = append(out, name)
		}
	}
	sort.Strings(out)
	return out
}

func shared(a, b map[string]reflect.Type) []string {
	var out []string
	for name := range a {
		if _, ok := b[name]; ok {
			out = append(out, name)
		}
	}
	sort.Strings(out)
	return out
}

func join(path, name string) string {
	if path == "" {
		return name
	}
	return path + "." + name
}

func at(path string) string {
	if path == "" {
		return "(root)"
	}
	return path
}

type InlineFixture struct {
	A string `json:"a"`
}

func TestJSONShapeComparison(t *testing.T) {
	type inner struct {
		A string `json:"a"`
	}
	type base struct {
		Name  string           `json:"name"`
		Count int64            `json:"count,omitempty"`
		Inner *inner           `json:"inner,omitempty"`
		List  []inner          `json:"list,omitempty"`
		Open  map[string]any   `json:"open,omitempty"`
		Tags  map[string]int64 `json:"tags,omitempty"`
	}

	t.Run("accepts an identical shape", func(t *testing.T) {
		assert.Empty(t, compareShapes(reflect.TypeOf(base{}), reflect.TypeOf(base{}), ""))
	})

	t.Run("accepts a pointer in place of a value", func(t *testing.T) {
		type relaxed struct {
			Name  string           `json:"name"`
			Count *int64           `json:"count,omitempty"`
			Inner *inner           `json:"inner,omitempty"`
			List  []inner          `json:"list,omitempty"`
			Open  map[string]any   `json:"open,omitempty"`
			Tags  map[string]int64 `json:"tags,omitempty"`
		}
		assert.Empty(t, compareShapes(reflect.TypeOf(base{}), reflect.TypeOf(relaxed{}), ""))
	})

	t.Run("accepts a named string in place of a string", func(t *testing.T) {
		type named string
		type enum struct {
			Name named `json:"name"`
		}
		type plain struct {
			Name string `json:"name"`
		}
		assert.Empty(t, compareShapes(reflect.TypeOf(plain{}), reflect.TypeOf(enum{}), ""))
	})

	t.Run("flattens an inline embedded struct", func(t *testing.T) {
		type embedded struct {
			InlineFixture `json:",inline"`
			B             string `json:"b"`
		}
		type flat struct {
			A string `json:"a"`
			B string `json:"b"`
		}
		assert.Empty(t, compareShapes(reflect.TypeOf(flat{}), reflect.TypeOf(embedded{}), ""))
	})

	t.Run("reports a missing property", func(t *testing.T) {
		type short struct {
			Name string `json:"name"`
		}
		problems := compareShapes(reflect.TypeOf(base{}), reflect.TypeOf(short{}), "")
		assert.Len(t, problems, 5)
		assert.Contains(t, strings.Join(problems, "\n"), `missing "count"`)
	})

	t.Run("reports an extra property", func(t *testing.T) {
		type long struct {
			Name  string           `json:"name"`
			Count int64            `json:"count,omitempty"`
			Inner *inner           `json:"inner,omitempty"`
			List  []inner          `json:"list,omitempty"`
			Open  map[string]any   `json:"open,omitempty"`
			Tags  map[string]int64 `json:"tags,omitempty"`
			Extra string           `json:"extra"`
		}
		problems := compareShapes(reflect.TypeOf(base{}), reflect.TypeOf(long{}), "")
		assert.Len(t, problems, 1)
		assert.Contains(t, problems[0], `declares "extra"`)
	})

	t.Run("reports a changed value shape", func(t *testing.T) {
		type retyped struct {
			Name  int64            `json:"name"`
			Count int64            `json:"count,omitempty"`
			Inner *inner           `json:"inner,omitempty"`
			List  []inner          `json:"list,omitempty"`
			Open  map[string]any   `json:"open,omitempty"`
			Tags  map[string]int64 `json:"tags,omitempty"`
		}
		problems := compareShapes(reflect.TypeOf(base{}), reflect.TypeOf(retyped{}), "")
		assert.Len(t, problems, 1)
		assert.Contains(t, problems[0], "name")
		assert.Contains(t, problems[0], "JSON string")
	})

	t.Run("reports a nested mismatch by path", func(t *testing.T) {
		type otherInner struct {
			A int64 `json:"a"`
		}
		type nested struct {
			Name  string           `json:"name"`
			Count int64            `json:"count,omitempty"`
			Inner *otherInner      `json:"inner,omitempty"`
			List  []inner          `json:"list,omitempty"`
			Open  map[string]any   `json:"open,omitempty"`
			Tags  map[string]int64 `json:"tags,omitempty"`
		}
		problems := compareShapes(reflect.TypeOf(base{}), reflect.TypeOf(nested{}), "")
		assert.Len(t, problems, 1)
		assert.Contains(t, problems[0], "inner.a")
	})

	t.Run("terminates on a recursive type", func(t *testing.T) {
		type node struct {
			And  []node  `json:"and,omitempty"`
			Not  *node   `json:"not,omitempty"`
			Leaf *string `json:"leaf,omitempty"`
		}
		done := make(chan []string, 1)
		go func() { done <- compareShapes(reflect.TypeOf(node{}), reflect.TypeOf(node{}), "") }()
		select {
		case problems := <-done:
			assert.Empty(t, problems)
		case <-time.After(5 * time.Second):
			t.Fatal("comparison did not terminate on a recursive type")
		}
	})

	t.Run("still reports a mismatch inside a recursive type", func(t *testing.T) {
		type want struct {
			And  []want  `json:"and,omitempty"`
			Leaf *string `json:"leaf,omitempty"`
		}
		type got struct {
			And  []got  `json:"and,omitempty"`
			Leaf *int64 `json:"leaf,omitempty"`
		}
		problems := compareShapes(reflect.TypeOf(want{}), reflect.TypeOf(got{}), "")
		assert.NotEmpty(t, problems)
		assert.Contains(t, strings.Join(problems, "\n"), "leaf")
	})

	t.Run("reports an open object narrowed to a struct", func(t *testing.T) {
		type narrowed struct {
			Name  string           `json:"name"`
			Count int64            `json:"count,omitempty"`
			Inner *inner           `json:"inner,omitempty"`
			List  []inner          `json:"list,omitempty"`
			Open  inner            `json:"open,omitempty"`
			Tags  map[string]int64 `json:"tags,omitempty"`
		}
		problems := compareShapes(reflect.TypeOf(base{}), reflect.TypeOf(narrowed{}), "")
		assert.Len(t, problems, 1)
		assert.Contains(t, problems[0], "open")
		assert.Contains(t, problems[0], "open object")
	})
}
