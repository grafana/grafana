package ofrep

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsPublic(t *testing.T) {
	tests := []struct {
		name     string
		metadata map[string]any
		want     bool
	}{
		{name: "nil metadata", metadata: nil, want: false},
		{name: "public bool true", metadata: map[string]any{"public": true}, want: true},
		{name: "public bool false", metadata: map[string]any{"public": false}, want: false},
		{name: `public string "true"`, metadata: map[string]any{"public": "true"}, want: true},
		{name: `public string "false"`, metadata: map[string]any{"public": "false"}, want: false},
		{name: `public string "TRUE" (case insensitive)`, metadata: map[string]any{"public": "TRUE"}, want: true},
		{name: "public wrong type (number)", metadata: map[string]any{"public": 1}, want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, isPublic(tt.metadata))
		})
	}
}
