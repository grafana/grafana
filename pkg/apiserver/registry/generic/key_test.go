package generic

import (
	"context"
	"reflect"
	"strings"
	"testing"

	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestParseKey(t *testing.T) {
	tests := []struct {
		name     string
		raw      string
		expected *Key
		wantErr  bool
	}{
		{
			name:     "All keys",
			raw:      "/group/test-group/resource/test-resource/namespace/test-namespace/name/test-name",
			expected: &Key{Group: "test-group", Resource: "test-resource", Namespace: "test-namespace", Name: "test-name"},
			wantErr:  false,
		},
		{
			name:     "Missing group",
			raw:      "/resource/test-resource/namespace/test-namespace/name/test-name",
			expected: &Key{Group: "", Resource: "test-resource", Namespace: "test-namespace", Name: "test-name"},
			wantErr:  false,
		},
		{
			name:     "Missing namespace",
			raw:      "/group/test-group/resource/test-resource/name/test-name",
			expected: &Key{Group: "test-group", Resource: "test-resource", Namespace: "", Name: "test-name"},
			wantErr:  false,
		},
		{
			name:     "Missing name",
			raw:      "/group/test-group/resource/test-resource/namespace/test-namespace",
			expected: &Key{Group: "test-group", Resource: "test-resource", Namespace: "test-namespace", Name: ""},
			wantErr:  false,
		},
		{
			name:     "Missing resource",
			raw:      "/group/test-group/namespace/test-namespace/name/test-name",
			expected: nil,
			wantErr:  true,
		},
		{
			name:     "Empty string",
			raw:      "",
			expected: nil,
			wantErr:  true,
		},
		{
			name:     "Invalid key",
			raw:      "/",
			expected: nil,
			wantErr:  true,
		},
		{
			name:     "Support kube-aggregator format",
			raw:      "/group/test-group/resource/test-resource/test-name",
			expected: &Key{Group: "test-group", Resource: "test-resource", Name: "test-name"},
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseKey(tt.raw)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseKey() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !reflect.DeepEqual(got, tt.expected) {
				t.Errorf("ParseKey() = %v, expected %v", got, tt.expected)
			}
		})
	}
}

func BenchmarkKey_String(b *testing.B) {
	key := &Key{Group: "test-group", Resource: "test-resource", Namespace: "test-namespace", Name: "test-name"}
	for i := 0; i < b.N; i++ {
		_ = key.String()
	}
}
func TestKey_String(t *testing.T) {
	tests := []struct {
		name     string
		key      *Key
		expected string
	}{
		{
			name:     "All fields",
			key:      &Key{Group: "test-group", Resource: "test-resource", Namespace: "test-namespace", Name: "test-name"},
			expected: "/group/test-group/resource/test-resource/namespace/test-namespace/name/test-name",
		},
		{
			name:     "Missing group",
			key:      &Key{Resource: "test-resource", Namespace: "test-namespace", Name: "test-name"},
			expected: "/resource/test-resource/namespace/test-namespace/name/test-name",
		},
		{
			name:     "Missing namespace",
			key:      &Key{Group: "test-group", Resource: "test-resource", Name: "test-name"},
			expected: "/group/test-group/resource/test-resource/name/test-name",
		},
		{
			name:     "Missing name",
			key:      &Key{Group: "test-group", Resource: "test-resource", Namespace: "test-namespace"},
			expected: "/group/test-group/resource/test-resource/namespace/test-namespace",
		},
		{
			name:     "Missing resource",
			key:      &Key{Group: "test-group", Namespace: "test-namespace", Name: "test-name"},
			expected: "/group/test-group/namespace/test-namespace/name/test-name",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.key.String()
			if got != tt.expected {
				t.Errorf("Key.String() = %s, expected %s", got, tt.expected)
			}
		})
	}
}

func TestClusterScopedKeyFunc(t *testing.T) {
	gr := schema.GroupResource{
		Group:    "iam.grafana.app",
		Resource: "globalroles",
	}
	keyFunc := ClusterScopedKeyFunc(gr)

	tests := []struct {
		name     string
		ctx      context.Context
		objName  string
		expected string
		wantErr  bool
		errMsg   string
	}{
		{
			name:     "Valid cluster-scoped resource",
			ctx:      context.Background(),
			objName:  "admin",
			expected: "/group/iam.grafana.app/resource/globalroles/name/admin",
			wantErr:  false,
		},
		{
			name:    "Empty name should error",
			ctx:     context.Background(),
			objName: "",
			wantErr: true,
			errMsg:  "Name parameter required",
		},
		{
			name:    "Invalid name with path separator",
			ctx:     context.Background(),
			objName: "invalid/name",
			wantErr: true,
			errMsg:  "Name parameter invalid",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := keyFunc(tt.ctx, tt.objName)
			if (err != nil) != tt.wantErr {
				t.Errorf("ClusterScopedKeyFunc() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr && err != nil && tt.errMsg != "" {
				// Just check if the error message contains the expected substring
				if !strings.Contains(err.Error(), tt.errMsg) {
					t.Errorf("ClusterScopedKeyFunc() error message = %q, expected to contain %q", err.Error(), tt.errMsg)
				}
				return
			}
			if got != tt.expected {
				t.Errorf("ClusterScopedKeyFunc() = %q, expected %q", got, tt.expected)
			}
		})
	}
}
