package state

import (
	"testing"

	"github.com/stretchr/testify/assert"
	ptr "github.com/xorcare/pointer"
)

func TestTemplateCaptureValueStringer(t *testing.T) {
	cases := []struct {
		name     string
		value    templateCaptureValue
		expected string
	}{{
		name:     "nil value returns null",
		value:    templateCaptureValue{Value: nil},
		expected: "null",
	}, {
		name:     "1.0 is returned as integer value",
		value:    templateCaptureValue{Value: ptr.Float64(1.0)},
		expected: "1",
	}, {
		name:     "1.1 is returned as decimal value",
		value:    templateCaptureValue{Value: ptr.Float64(1.1)},
		expected: "1.1",
	}}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			assert.Equal(t, c.expected, c.value.String())
		})
	}
}
