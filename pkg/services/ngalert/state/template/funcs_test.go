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
