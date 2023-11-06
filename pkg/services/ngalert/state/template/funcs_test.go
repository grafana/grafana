package template

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFilterLabelsFunc(t *testing.T) {
	l := Labels{"foo": "bar", "bar": "baz"}
	assert.Equal(t, Labels{"foo": "bar"}, filterLabelsFunc(l, "foo"))
}

func TestFilterLabelsReFunc(t *testing.T) {
	l := Labels{"foo": "bar", "bar": "baz"}
	assert.Equal(t, Labels{"foo": "bar"}, filterLabelsReFunc(l, "f.*"))
}

func TestRemoveLabelsFunc(t *testing.T) {
	l := Labels{"foo": "bar", "bar": "baz"}
	assert.Equal(t, Labels{"bar": "baz"}, removeLabelsFunc(l, "foo"))
}

func TestRemoveLabelsReFunc(t *testing.T) {
	l := Labels{"foo": "bar", "bar": "baz"}
	assert.Equal(t, Labels{"bar": "baz"}, removeLabelsReFunc(l, "f.*"))
}

func TestDeduplicateLabelsFunc(t *testing.T) {
	v := map[string]Value{
		"v1": {Labels: Labels{"foo": "bar", "bar": "foo"}, Value: 1},
		"v2": {Labels: Labels{"foo": "bar", "bar": "baz", "baz": "bat"}, Value: 2},
	}
	assert.Equal(t, Labels{"foo": "bar", "bar": "baz, foo", "baz": "bat"}, mergeLabelValuesFunc(v))
}

func TestDeduplicateLabelsFuncAllSameVal(t *testing.T) {
	v := map[string]Value{
		"v1": {Labels: Labels{"foo": "bar", "bar": "baz"}, Value: 1},
		"v2": {Labels: Labels{"foo": "bar", "bar": "baz"}, Value: 2},
	}
	assert.Equal(t, Labels{"foo": "bar", "bar": "baz"}, mergeLabelValuesFunc(v))
}

func TestDeduplicateLabelsFuncNoDuplicates(t *testing.T) {
	v := map[string]Value{
		"v1": {Labels: Labels{"foo": "bar"}, Value: 1},
		"v2": {Labels: Labels{"bar": "baz"}, Value: 2},
	}
	assert.Equal(t, Labels{"foo": "bar", "bar": "baz"}, mergeLabelValuesFunc(v))
}
