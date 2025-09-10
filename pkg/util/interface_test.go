package util

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsInterfaceNil(t *testing.T) {
	testCases := []struct {
		name     string
		value    interface{}
		expected bool
	}{
		// True nil cases
		{"true nil interface", nil, true},
		{"nil pointer", (*int)(nil), true},
		{"nil slice", ([]int)(nil), true},
		{"nil map", (map[string]int)(nil), true},
		{"nil function", (func())(nil), true},
		{"nil interface wrapped in interface", (interface{})(nil), true},

		// Channels are not handled by IsInterfaceNil (not in switch statement)
		{"nil channel - not handled", (chan int)(nil), false},

		// Non-nil cases
		{"non-nil pointer", func() interface{} { val := 42; return &val }(), false},
		{"non-nil slice", []int{1, 2, 3}, false},
		{"empty slice", []int{}, false},
		{"non-nil map", map[string]int{"key": 1}, false},
		{"empty map", make(map[string]int), false},
		{"non-nil function", func() {}, false},
		{"non-nil channel", make(chan int), false},

		// Basic value types
		{"string value", "hello", false},
		{"empty string", "", false},
		{"int value", 42, false},
		{"zero int", 0, false},
		{"bool true", true, false},
		{"bool false", false, false},
		{"float64", 3.14, false},
		{"complex128", complex(1, 2), false},

		// Composite value types
		{"struct value", struct{ x int }{x: 1}, false},
		{"array value", [3]int{1, 2, 3}, false},
		{"zero array", [3]int{}, false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := IsInterfaceNil(tc.value)
			assert.Equal(t, tc.expected, result, "IsInterfaceNil(%v) should return %t", tc.value, tc.expected)
		})
	}
}

func TestIsInterfaceNil_NestedInterfaces(t *testing.T) {
	testCases := []struct {
		name     string
		value    interface{}
		expected bool
	}{
		{
			name: "nested interface with nil",
			value: func() interface{} {
				var inner *int = nil
				var middle interface{} = inner
				return middle
			}(),
			expected: true,
		},
		{
			name: "nested interface with value",
			value: func() interface{} {
				val := 42
				var inner *int = &val
				var middle interface{} = inner
				return middle
			}(),
			expected: false,
		},
		{
			name: "interface containing interface with value",
			value: func() interface{} {
				var inner interface{} = 42
				var outer interface{} = inner
				return outer
			}(),
			expected: false,
		},
		{
			name: "interface containing nil interface",
			value: func() interface{} {
				var inner interface{} = nil
				var outer interface{} = inner
				return outer
			}(),
			expected: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := IsInterfaceNil(tc.value)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestIsInterfaceNil_ReflectKinds(t *testing.T) {
	t.Run("handles specific nilable reflect kinds", func(t *testing.T) {
		// Test the specific nilable kinds that the function handles
		// according to its switch statement: Ptr, Slice, Map, Func, Interface
		nilableTestCases := []struct {
			name  string
			value interface{}
		}{
			{"nil pointer", (*int)(nil)},
			{"nil slice", ([]int)(nil)},
			{"nil map", (map[string]int)(nil)},
			{"nil function", (func())(nil)},
			{"nil interface", (interface{})(nil)},
		}

		for _, tc := range nilableTestCases {
			t.Run(tc.name, func(t *testing.T) {
				assert.True(t, IsInterfaceNil(tc.value), "%s should be detected as nil", tc.name)
			})
		}
	})

	t.Run("does not handle channels and other nilable types", func(t *testing.T) {
		// Test that nilable kinds NOT in the switch statement return false
		unhandledTestCases := []struct {
			name  string
			value interface{}
		}{
			{"nil channel", (chan int)(nil)},
			// UnsafePointer would be another example, but harder to test
		}

		for _, tc := range unhandledTestCases {
			t.Run(tc.name, func(t *testing.T) {
				assert.False(t, IsInterfaceNil(tc.value), "%s should not be detected as nil (unhandled type)", tc.name)
			})
		}
	})

	t.Run("handles non-nilable kinds", func(t *testing.T) {
		// Test kinds that cannot be nil
		nonNilableTestCases := []struct {
			name  string
			value interface{}
		}{
			{"int", 42},
			{"string", "test"},
			{"bool", true},
			{"struct", struct{ x int }{x: 1}},
			{"array", [3]int{1, 2, 3}},
			{"float64", 3.14},
			{"complex128", complex(1, 2)},
		}

		for _, tc := range nonNilableTestCases {
			t.Run(tc.name, func(t *testing.T) {
				assert.False(t, IsInterfaceNil(tc.value), "%s should not be detected as nil (non-nilable)", tc.name)
			})
		}
	})
}