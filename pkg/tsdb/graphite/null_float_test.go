package graphite

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
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
		{
			name:     "leading whitespace",
			input:    []byte(" 1.5"),
			expected: FloatFrom(1.5),
		},
		{
			name:     "trailing whitespace",
			input:    []byte("1.5 \n"),
			expected: FloatFrom(1.5),
		},
		{
			name:     "null with whitespace",
			input:    []byte(" null "),
			expected: NewFloat(0, false),
		},
		{
			name:        "overflow",
			input:       []byte("1e400"),
			expectError: true,
		},
		{
			name:        "NaN",
			input:       []byte("NaN"),
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

func TestFloat_UnmarshalJSONRenderResponse(t *testing.T) {
	tests := []struct {
		name        string
		value       string
		expected    Float
		expectError bool
	}{
		{name: "integer", value: "42", expected: FloatFrom(42)},
		{name: "decimal", value: "123.456", expected: FloatFrom(123.456)},
		{name: "negative", value: "-42.5", expected: FloatFrom(-42.5)},
		{name: "zero", value: "0", expected: FloatFrom(0)},
		{name: "negative zero", value: "-0", expected: FloatFrom(math.Copysign(0, -1))},
		{name: "exponent", value: "1.5e3", expected: FloatFrom(1500)},
		{name: "negative exponent", value: "1E-2", expected: FloatFrom(0.01)},
		{name: "signed upper-case exponent", value: "-2.5E+10", expected: FloatFrom(-2.5e10)},
		{name: "largest float64", value: "1.7976931348623157e308", expected: FloatFrom(math.MaxFloat64)},
		{name: "smallest float64", value: "5e-324", expected: FloatFrom(math.SmallestNonzeroFloat64)},
		{name: "integer above 2^53 rounds", value: "9007199254740993", expected: FloatFrom(9007199254740992)},
		{name: "integer above int64", value: "12345678901234567890123", expected: FloatFrom(1.2345678901234568e22)},
		{name: "underflow rounds to zero", value: "1e-400", expected: FloatFrom(0)},
		{name: "overflow", value: "1e400", expectError: true},
		{name: "negative overflow", value: "-1e400", expectError: true},
		{name: "whitespace around value", value: " \n\t1.5\r\n ", expected: FloatFrom(1.5)},
		{name: "null", value: "null", expected: NewFloat(0, false)},
		{name: "null with whitespace", value: " null ", expected: NewFloat(0, false)},
		{name: "sql.NullFloat64 object", value: `{"Float64": 42.5, "Valid": true}`, expected: FloatFrom(42.5)},
		{name: "NaN string", value: `"NaN"`, expectError: true},
		{name: "Infinity string", value: `"Infinity"`, expectError: true},
		{name: "-Infinity string", value: `"-Infinity"`, expectError: true},
		{name: "numeric string", value: `"1.5"`, expectError: true},
		{name: "bare NaN", value: "NaN", expectError: true},
		{name: "bare Infinity", value: "Infinity", expectError: true},
		{name: "bare -Infinity", value: "-Infinity", expectError: true},
		{name: "leading zero", value: "01", expectError: true},
		{name: "trailing decimal point", value: "1.", expectError: true},
		{name: "boolean", value: "true", expectError: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body := `[{"target":"a","datapoints":[[` + tt.value + `,1700000000]]}]`
			var series []TargetResponseDTO
			err := json.Unmarshal([]byte(body), &series)
			if tt.expectError {
				assert.Error(t, err)
				return
			}
			require.NoError(t, err)
			point := series[0].DataPoints[0]
			assert.Equal(t, tt.expected, point[0])
			assert.Equal(t, math.Float64bits(tt.expected.Float64), math.Float64bits(point[0].Float64))
			assert.Equal(t, FloatFrom(1700000000), point[1])
		})
	}
}

func BenchmarkUnmarshalRenderResponse(b *testing.B) {
	series := make([]TargetResponseDTO, 100)
	for s := range series {
		target := fmt.Sprintf("servers.web%03d.cpu.usage", s)
		points := make(DataTimeSeriesPoints, 1000)
		for p := range points {
			value := FloatFrom(float64(s*len(points)+p) * 1.0137 / 7)
			if (s+p)%10 == 0 {
				value = NewFloat(0, false)
			}
			points[p] = DataTimePoint{value, FloatFrom(float64(1700000000 + 60*p))}
		}
		series[s] = TargetResponseDTO{Target: target, DataPoints: points, Tags: map[string]any{"name": target}}
	}
	body, err := json.Marshal(series)
	require.NoError(b, err)

	b.SetBytes(int64(len(body)))
	b.ReportAllocs()
	for b.Loop() {
		var got []TargetResponseDTO
		require.NoError(b, json.Unmarshal(body, &got))
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
