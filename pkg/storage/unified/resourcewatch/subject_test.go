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
		gvr       schema.GroupVersionResource
		namespace string
		want      string
	}{
		{
			name:      "namespaced, version-agnostic",
			gvr:       gvr,
			namespace: "default",
			want:      "provisioning.grafana.app.default.repositories",
		},
		{
			name:      "empty namespace becomes the single-token wildcard",
			gvr:       gvr,
			namespace: "",
			want:      "provisioning.grafana.app.*.repositories",
		},
		{
			name:      "version is ignored",
			gvr:       schema.GroupVersionResource{Group: "provisioning.grafana.app", Version: "v9", Resource: "repositories"},
			namespace: "stacks-1",
			want:      "provisioning.grafana.app.stacks-1.repositories",
		},
		{
			name:      "groupless resource",
			gvr:       schema.GroupVersionResource{Resource: "configmaps"},
			namespace: "default",
			want:      ".default.configmaps",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, Subject(tt.gvr, tt.namespace))
		})
	}
}
