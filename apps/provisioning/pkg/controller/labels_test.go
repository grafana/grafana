package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsPendingDelete(t *testing.T) {
	tests := []struct {
		name   string
		labels map[string]string
		want   bool
	}{
		{
			name:   "label absent returns false",
			labels: map[string]string{},
			want:   false,
		},
		{
			name:   "nil labels returns false",
			labels: nil,
			want:   false,
		},
		{
			name:   "label set to false returns false",
			labels: map[string]string{LabelPendingDelete: "false"},
			want:   false,
		},
		{
			name:   "label set to true returns true",
			labels: map[string]string{LabelPendingDelete: "true"},
			want:   true,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := IsPendingDelete(tc.labels)
			assert.Equal(t, tc.want, got)
		})
	}
}
