package resourcewatch

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestSubject(t *testing.T) {
	gvr := schema.GroupVersionResource{
		Group:    "provisioning.grafana.app",
		Version:  "v0alpha1",
		Resource: "repositories",
	}

	tests := []struct {
		name      string
		namespace string
		want      string
	}{
		{
			name:      "namespaced, version-agnostic",
			namespace: "default",
			want:      "provisioning.grafana.app.default.repositories",
		},
		{
			name:      "empty namespace becomes the single-token wildcard",
			namespace: "",
			want:      "provisioning.grafana.app.*.repositories",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, Subject(gvr, tt.namespace))
		})
	}
}
