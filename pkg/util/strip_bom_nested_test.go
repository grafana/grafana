package util

import (
	"reflect"
	"testing"
)

func TestStripBOMFromStructNestedValues(t *testing.T) {
	type namedString string
	type element struct {
		Title   string
		Options any
	}
	input := struct {
		Elements map[string]element
		Values   map[string]any
		Named    map[string]namedString
		Nil      any
	}{
		Elements: map[string]element{"panel": {Title: "\ufefftitle", Options: map[string]any{"text": "value\ufeff", "list": []any{"\ufeffitem", nil}}}},
		Values:   map[string]any{"nested": map[string]any{"value": "\ufefftext"}, "number": 42},
		Named:    map[string]namedString{"key": "\ufeffnamed"},
	}
	expected := struct {
		Elements map[string]element
		Values   map[string]any
		Named    map[string]namedString
		Nil      any
	}{
		Elements: map[string]element{"panel": {Title: "title", Options: map[string]any{"text": "value", "list": []any{"item", nil}}}},
		Values:   map[string]any{"nested": map[string]any{"value": "text"}, "number": 42},
		Named:    map[string]namedString{"key": "named"},
	}
	StripBOMFromStruct(&input)
	if !reflect.DeepEqual(expected, input) {
		t.Errorf("got %#v, want %#v", input, expected)
	}
}
