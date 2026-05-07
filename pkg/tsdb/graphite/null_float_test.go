package graphite

import (
	"database/sql"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewFloat(t *testing.T) {
	tests := []struct {
		name     string
		input    float64
		valid    bool
		expected Float
	}{
		{
			name:  "valid float",
			input: 42.5,
			valid: true,
			expected: Float{
				NullFloat64: sql.NullFloat64{Float64: 42.5, Valid: true},
			},
		},
		{
			name:  "invalid float",
			input: 42.5,
			valid: false,
			expected: Float{
				NullFloat64: sql.NullFloat64{Float64: 42.5, Valid: false},
			},
		},
		{
			name:  "zero",
			input: 0,
			valid: true,
			expected: Float{
				NullFloat64: sql.NullFloat64{Float64: 0, Valid: true},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := NewFloat(tt.input, tt.valid)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestFloatFrom(t *testing.T) {
	result := FloatFrom(123.456)
	expected := Float{NullFloat64: sql.NullFloat64{Float64: 123.456, Valid: true}}
	assert.Equal(t, expected, result)
}

func TestFloatFromPtr(t *testing.T) {
	f := 42.5
	result := FloatFromPtr(&f)
	expected := Float{NullFloat64: sql.NullFloat64{Float64: 42.5, Valid: true}}
	assert.Equal(t, expected, result)

	result = FloatFromPtr(nil)
	expected = Float{NullFloat64: sql.NullFloat64{Valid: false}}
	assert.Equal(t, expected, result)
}

func TestFloatFromString(t *testing.T) {
	result, err := FloatFromString("123.456", "null")
	require.NoError(t, err)
	expected := Float{NullFloat64: sql.NullFloat64{Float64: 123.456, Valid: true}}
	assert.Equal(t, expected, result)

	result, err = FloatFromString("null", "null")
	require.NoError(t, err)
	expected = Float{NullFloat64: sql.NullFloat64{Valid: false}}
	assert.Equal(t, expected, result)

	_, err = FloatFromString("number", "null")
	assert.Error(t, err)
}

func TestFloat_UnmarshalJSON(t *testing.T) {
	tests := []struct {
		name        string
		input       []byte
		expected    Float
		expectError bool
	}{
		{
			name:  "valid float",
			input: []byte("123.456"),
			expected: Float{
				NullFloat64: sql.NullFloat64{Float64: 123.456, Valid: true},
			},
		},
		{
			name:  "null",
			input: []byte("null"),
			expected: Float{
				NullFloat64: sql.NullFloat64{Valid: false},
			},
		},
		{
			name:  "sql.NullFloat64 - valid",
			input: []byte(`{"Float64": 42.5, "Valid": true}`),
			expected: Float{
				NullFloat64: sql.NullFloat64{Float64: 42.5, Valid: true},
			},
		},
		{
			name:  "sql.NullFloat64 - invalid",
			input: []byte(`{"Float64": 0, "Valid": false}`),
			expected: Float{
				NullFloat64: sql.NullFloat64{Float64: 0, Valid: true}, // Valid gets overridden to true when unmarshaling succeeds
			},
		},
		{
			name:        "invalid JSON",
			input:       []byte("invalid"),
			expectError: true,
		},
		{
			name:        "string input",
			input:       []byte(`"123.456"`),
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var result Float
			err := result.UnmarshalJSON(tt.input)
			if tt.expectError {
				assert.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}

func TestFloat_UnmarshalText(t *testing.T) {
	var f Float
	err := f.UnmarshalText([]byte("123.456"))
	require.NoError(t, err)
	expected := Float{NullFloat64: sql.NullFloat64{Float64: 123.456, Valid: true}}
	assert.Equal(t, expected, f)

	var f2 Float
	err = f2.UnmarshalText([]byte(""))
	require.NoError(t, err)
	expected = Float{NullFloat64: sql.NullFloat64{Valid: false}}
	assert.Equal(t, expected, f2)

	var f3 Float
	err = f3.UnmarshalText([]byte("null"))
	require.NoError(t, err)
	expected = Float{NullFloat64: sql.NullFloat64{Valid: false}}
	assert.Equal(t, expected, f3)

	var f4 Float
	err = f4.UnmarshalText([]byte("not-a-number"))
	assert.Error(t, err)
}

func TestFloat_MarshalJSON(t *testing.T) {
	f := Float{NullFloat64: sql.NullFloat64{Float64: 123.456, Valid: true}}
	data, err := f.MarshalJSON()
	require.NoError(t, err)
	assert.Equal(t, "123.456", string(data))

	f = Float{NullFloat64: sql.NullFloat64{Valid: false}}
	data, err = f.MarshalJSON()
	require.NoError(t, err)
	assert.Equal(t, "null", string(data))
}

func TestFloat_MarshalText(t *testing.T) {
	f := Float{NullFloat64: sql.NullFloat64{Float64: 123.456, Valid: true}}
	data, err := f.MarshalText()
	require.NoError(t, err)
	assert.Equal(t, "123.456", string(data))

	f = Float{NullFloat64: sql.NullFloat64{Valid: false}}
	data, err = f.MarshalText()
	require.NoError(t, err)
	assert.Equal(t, "", string(data))
}

func TestFloat_String(t *testing.T) {
	f := Float{NullFloat64: sql.NullFloat64{Float64: 123.456789, Valid: true}}
	assert.Equal(t, "123.457", f.String())

	f = Float{NullFloat64: sql.NullFloat64{Valid: false}}
	assert.Equal(t, "null", f.String())
}

func TestFloat_FullString(t *testing.T) {
	f := Float{NullFloat64: sql.NullFloat64{Float64: 123.456789, Valid: true}}
	assert.Equal(t, "123.456789", f.FullString())

	f = Float{NullFloat64: sql.NullFloat64{Valid: false}}
	assert.Equal(t, "null", f.FullString())
}

func TestFloat_IsZero(t *testing.T) {
	f := Float{NullFloat64: sql.NullFloat64{Float64: 0, Valid: true}}
	assert.False(t, f.IsZero())

	f = Float{NullFloat64: sql.NullFloat64{Valid: false}}
	assert.True(t, f.IsZero())
}

func TestFloat_JSONRoundTrip(t *testing.T) {
	testCases := []Float{
		{NullFloat64: sql.NullFloat64{Float64: 123.456, Valid: true}},
		{NullFloat64: sql.NullFloat64{Float64: 0, Valid: true}},
		{NullFloat64: sql.NullFloat64{Valid: false}},
	}

	for _, original := range testCases {
		// Marshal to JSON
		data, err := json.Marshal(original)
		require.NoError(t, err)

		// Unmarshal back
		var result Float
		err = json.Unmarshal(data, &result)
		require.NoError(t, err)

		// Compare
		assert.Equal(t, original, result)
	}
}
