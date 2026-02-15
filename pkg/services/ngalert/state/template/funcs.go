package template

import (
	"encoding/json"
	"fmt"
	"net/url"
	"reflect"
	"regexp"
	"slices"
	"sort"
	"strings"
	"text/template"
)

type query struct {
	Datasource string `json:"datasource"`
	Expr       string `json:"expr"`
}

const (
	FilterLabelFuncName      = "filterLabels"
	FilterLabelReFuncName    = "filterLabelsRe"
	GraphLinkFuncName        = "graphLink"
	RemoveLabelsFuncName     = "removeLabels"
	RemoveLabelsReFuncName   = "removeLabelsRe"
	TableLinkFuncName        = "tableLink"
	MergeLabelValuesFuncName = "mergeLabelValues"
	// SortByFuncName is the name of the function that sorts a list of objects by a field.
	SortByFuncName = "sortBy"
)

var (
	defaultFuncs = template.FuncMap{
		FilterLabelFuncName:      filterLabelsFunc,
		FilterLabelReFuncName:    filterLabelsReFunc,
		GraphLinkFuncName:        graphLinkFunc,
		RemoveLabelsFuncName:     removeLabelsFunc,
		RemoveLabelsReFuncName:   removeLabelsReFunc,
		TableLinkFuncName:        tableLinkFunc,
		MergeLabelValuesFuncName: mergeLabelValuesFunc,
		SortByFuncName:           sortByFunc,
	}
)

// filterLabelsFunc removes all labels that do not match the string.
func filterLabelsFunc(m Labels, match string) Labels {
	res := make(Labels)
	for k, v := range m {
		if k == match {
			res[k] = v
		}
	}
	return res
}

// filterLabelsReFunc removes all labels that do not match the regex.
func filterLabelsReFunc(m Labels, pattern string) Labels {
	re := regexp.MustCompile(pattern)
	res := make(Labels)
	for k, v := range m {
		if re.MatchString(k) {
			res[k] = v
		}
	}
	return res
}

func graphLinkFunc(data string) string {
	var q query
	if err := json.Unmarshal([]byte(data), &q); err != nil {
		return ""
	}
	datasource := url.QueryEscape(q.Datasource)
	expr := url.QueryEscape(q.Expr)
	return fmt.Sprintf(`/explore?left={"datasource":%[1]q,"queries":[{"datasource":%[1]q,"expr":%q,"instant":false,"range":true,"refId":"A"}],"range":{"from":"now-1h","to":"now"}}`, datasource, expr)
}

// removeLabelsFunc removes all labels that match the string.
func removeLabelsFunc(m Labels, match string) Labels {
	res := make(Labels)
	for k, v := range m {
		if k != match {
			res[k] = v
		}
	}
	return res
}

// removeLabelsReFunc removes all labels that match the regex.
func removeLabelsReFunc(m Labels, pattern string) Labels {
	re := regexp.MustCompile(pattern)
	res := make(Labels)
	for k, v := range m {
		if !re.MatchString(k) {
			res[k] = v
		}
	}
	return res
}

func tableLinkFunc(data string) string {
	var q query
	if err := json.Unmarshal([]byte(data), &q); err != nil {
		return ""
	}
	datasource := url.QueryEscape(q.Datasource)
	expr := url.QueryEscape(q.Expr)
	return fmt.Sprintf(`/explore?left={"datasource":%[1]q,"queries":[{"datasource":%[1]q,"expr":%q,"instant":true,"range":false,"refId":"A"}],"range":{"from":"now-1h","to":"now"}}`, datasource, expr)
}

// mergeLabelValuesFunc returns a map of label keys to deduplicated and comma separated values.
func mergeLabelValuesFunc(values map[string]Value) Labels {
	type uniqueLabelVals map[string]struct{}

	labels := make(map[string]uniqueLabelVals)
	for _, value := range values {
		for k, v := range value.Labels {
			var ul uniqueLabelVals
			var ok bool
			if ul, ok = labels[k]; !ok {
				ul = uniqueLabelVals{}
				labels[k] = ul
			}
			ul[v] = struct{}{}
		}
	}

	res := make(Labels)
	for label, vals := range labels {
		keys := make([]string, 0, len(vals))
		for val := range vals {
			keys = append(keys, val)
		}
		slices.Sort(keys)
		res[label] = strings.Join(keys, ", ")
	}
	return res
}

// sortByFunc sorts a list of objects by a field.
// It supports sorting by a field in a struct or a key in a map.
// Nested fields can be accessed using dot notation (e.g. "Labels.severity").
func sortByFunc(field string, list interface{}) (interface{}, error) {
	if list == nil {
		return nil, nil
	}

	val := reflect.ValueOf(list)
	if val.Kind() != reflect.Slice && val.Kind() != reflect.Array {
		return nil, fmt.Errorf("sortBy: expected slice or array, got %T", list)
	}

	length := val.Len()
	if length == 0 {
		return list, nil
	}

	// Validate field existence on the first element to fail fast
	if length > 0 {
		_, err := getFieldResult(val.Index(0), field)
		if err != nil {
			return nil, err
		}
	}

	newSlice := reflect.MakeSlice(val.Type(), length, length)
	reflect.Copy(newSlice, val)

	var err error

	sort.Slice(newSlice.Interface(), func(i, j int) bool {
		if err != nil {
			return false
		}

		itemI := newSlice.Index(i)
		itemJ := newSlice.Index(j)

		valI, e1 := getFieldResult(itemI, field)
		if e1 != nil {
			err = e1
			return false
		}

		valJ, e2 := getFieldResult(itemJ, field)
		if e2 != nil {
			err = e2
			return false
		}

		return less(valI, valJ)
	})

	if err != nil {
		return nil, err
	}

	return newSlice.Interface(), nil
}

func getFieldResult(obj reflect.Value, fieldPath string) (reflect.Value, error) {
	parts := strings.Split(fieldPath, ".")
	curr := obj

	for _, part := range parts {
		if !curr.IsValid() {
			return reflect.Value{}, fmt.Errorf("property %q is nil", part)
		}

		for curr.Kind() == reflect.Ptr || curr.Kind() == reflect.Interface {
			if curr.IsNil() {
				return reflect.Value{}, nil
			}
			curr = curr.Elem()
		}

		if curr.Kind() == reflect.Struct {
			f := curr.FieldByName(part)
			if !f.IsValid() {
				return reflect.Value{}, fmt.Errorf("field %q not found in struct %s", part, curr.Type())
			}
			curr = f
		} else if curr.Kind() == reflect.Map {
			key := reflect.ValueOf(part)
			val := curr.MapIndex(key)
			if !val.IsValid() {
				return reflect.Value{}, nil
			}
			curr = val
		} else {
			return reflect.Value{}, fmt.Errorf("cannot access field %q on type %s", part, curr.Kind())
		}
	}
	return curr, nil
}

func less(v1, v2 reflect.Value) bool {
	if !v1.IsValid() {
		return true
	}
	if !v2.IsValid() {
		return false
	}

	v1 = indirect(v1)
	v2 = indirect(v2)

	// After indirect, if we still have Ptr or Interface, it means it is nil.
	// We treat nil as less than any value.
	isNil1 := (v1.Kind() == reflect.Ptr || v1.Kind() == reflect.Interface) && v1.IsNil()
	isNil2 := (v2.Kind() == reflect.Ptr || v2.Kind() == reflect.Interface) && v2.IsNil()
	
	if isNil1 {
		return !isNil2 // nil < non-nil, nil !< nil
	}
	if isNil2 {
		return false // non-nil > nil
	}

	switch v1.Kind() {
	case reflect.String:
		s1 := v1.String()
		s2 := ""
		if v2.Kind() == reflect.String {
			s2 = v2.String()
		} else {
			s2 = fmt.Sprint(v2.Interface())
		}
		return s1 < s2
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		i1 := v1.Int()
		var i2 int64
		switch v2.Kind() {
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
			i2 = v2.Int()
		case reflect.Float32, reflect.Float64:
			i2 = int64(v2.Float())
		default:
			return fmt.Sprint(v1.Interface()) < fmt.Sprint(v2.Interface())
		}
		return i1 < i2
	case reflect.Float32, reflect.Float64:
		f1 := v1.Float()
		var f2 float64
		switch v2.Kind() {
		case reflect.Float32, reflect.Float64:
			f2 = v2.Float()
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
			f2 = float64(v2.Int())
		default:
			return fmt.Sprint(v1.Interface()) < fmt.Sprint(v2.Interface())
		}
		return f1 < f2
	}

	return fmt.Sprint(v1.Interface()) < fmt.Sprint(v2.Interface())
}
func indirect(v reflect.Value) reflect.Value {
	for v.Kind() == reflect.Ptr || v.Kind() == reflect.Interface {
		if v.IsNil() {
			return v
		}
		v = v.Elem()
	}
	return v
}
