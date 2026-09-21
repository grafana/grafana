package repository

import "testing"

func TestIsForceDelete(t *testing.T) {
	tests := []struct {
		name        string
		annotations map[string]string
		want        bool
	}{
		{name: "nil annotations", annotations: nil, want: false},
		{name: "annotation absent", annotations: map[string]string{"other": "true"}, want: false},
		{name: "set to true", annotations: map[string]string{ForceDeleteAnnotation: "true"}, want: true},
		{name: "set to false", annotations: map[string]string{ForceDeleteAnnotation: "false"}, want: false},
		{name: "set to non-boolean", annotations: map[string]string{ForceDeleteAnnotation: "yes"}, want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsForceDelete(tt.annotations); got != tt.want {
				t.Fatalf("IsForceDelete(%v) = %v, want %v", tt.annotations, got, tt.want)
			}
		})
	}
}
