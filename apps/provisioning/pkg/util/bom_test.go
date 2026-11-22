package util

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestStripBOM(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "string with BOM at start",
			input: "\ufeffHello World",
			want:  "Hello World",
		},
		{
			name:  "string with BOM in middle",
			input: "Hello\ufeffWorld",
			want:  "HelloWorld",
		},
		{
			name:  "string with multiple BOMs",
			input: "\ufeffHello\ufeffWorld\ufeff",
			want:  "HelloWorld",
		},
		{
			name:  "string without BOM",
			input: "Hello World",
			want:  "Hello World",
		},
		{
			name:  "empty string",
			input: "",
			want:  "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := StripBOM(tt.input)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestStripBOMFromBytes(t *testing.T) {
	tests := []struct {
		name  string
		input []byte
		want  []byte
	}{
		{
			name:  "bytes with UTF-8 BOM prefix",
			input: []byte{0xEF, 0xBB, 0xBF, 'H', 'e', 'l', 'l', 'o'},
			want:  []byte("Hello"),
		},
		{
			name:  "bytes with Unicode BOM character in string",
			input: []byte("\ufeffHello"),
			want:  []byte("Hello"),
		},
		{
			name:  "bytes with both UTF-8 BOM and Unicode BOM",
			input: []byte{0xEF, 0xBB, 0xBF, 0xEF, 0xBB, 0xBF, 'H', 'e', 'l', 'l', 'o'},
			want:  []byte("Hello"),
		},
		{
			name:  "bytes without BOM",
			input: []byte("Hello"),
			want:  []byte("Hello"),
		},
		{
			name:  "empty bytes",
			input: []byte{},
			want:  []byte(""),
		},
		{
			name:  "incomplete UTF-8 BOM",
			input: []byte{0xEF, 0xBB, 'H'},
			want:  []byte{0xEF, 0xBB, 'H'},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := StripBOMFromBytes(tt.input)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestStripBOMFromInterface(t *testing.T) {
	tests := []struct {
		name  string
		input any
		want  any
	}{
		{
			name:  "simple string with BOM",
			input: "\ufeffHello",
			want:  "Hello",
		},
		{
			name: "map with BOM in string values",
			input: map[string]any{
				"key1": "\ufeffvalue1",
				"key2": "value2",
			},
			want: map[string]any{
				"key1": "value1",
				"key2": "value2",
			},
		},
		{
			name: "nested map with BOMs",
			input: map[string]any{
				"outer": map[string]any{
					"inner": "\ufeffvalue",
				},
			},
			want: map[string]any{
				"outer": map[string]any{
					"inner": "value",
				},
			},
		},
		{
			name: "slice with BOM in string elements",
			input: []any{
				"\ufeffitem1",
				"item2",
				"\ufeffitem3",
			},
			want: []any{
				"item1",
				"item2",
				"item3",
			},
		},
		{
			name: "complex nested structure",
			input: map[string]any{
				"title": "\ufeffDashboard",
				"panels": []any{
					map[string]any{
						"type":  "\ufeffgraph",
						"title": "\ufeffPanel 1",
					},
					map[string]any{
						"type":  "table",
						"title": "\ufeffPanel 2",
					},
				},
			},
			want: map[string]any{
				"title": "Dashboard",
				"panels": []any{
					map[string]any{
						"type":  "graph",
						"title": "Panel 1",
					},
					map[string]any{
						"type":  "table",
						"title": "Panel 2",
					},
				},
			},
		},
		{
			name:  "non-string type (int)",
			input: 42,
			want:  42,
		},
		{
			name:  "non-string type (bool)",
			input: true,
			want:  true,
		},
		{
			name:  "nil value",
			input: nil,
			want:  nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := StripBOMFromInterface(tt.input)
			assert.Equal(t, tt.want, got)
		})
	}
}
