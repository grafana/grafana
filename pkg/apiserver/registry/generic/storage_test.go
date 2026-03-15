package generic

import (
	"context"
	"strings"
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestNewRegistryStore_KeyFuncSelection(t *testing.T) {
	scheme := runtime.NewScheme()

	scheme.AddKnownTypes(schema.GroupVersion{Group: "test.grafana.app", Version: "v1alpha1"},
		&mockObject{},
		&mockObjectList{},
	)
	clusterScopedResourceInfo := utils.NewResourceInfo(
		"iam.grafana.app",
		"v1alpha1",
		"globalroles",
		"globalrole",
		"GlobalRole",
		func() runtime.Object { return &mockObject{} },
		func() runtime.Object { return &mockObjectList{} },
		utils.TableColumns{},
	)
	clusterScopedResourceInfo = clusterScopedResourceInfo.WithClusterScope()

	namespacedResourceInfo := utils.NewResourceInfo(
		"example.grafana.app",
		"v1alpha1",
		"roles",
		"role",
		"Role",
		func() runtime.Object { return &mockObject{} },
		func() runtime.Object { return &mockObjectList{} },
		utils.TableColumns{},
	)

	tests := []struct {
		name                 string
		resourceInfo         utils.ResourceInfo
		testName             string
		testNamespace        string
		expectNamespaceError bool
		expectedKeyContains  string
	}{
		{
			name:                 "Cluster-scoped resource does not require namespace",
			resourceInfo:         clusterScopedResourceInfo,
			testName:             "admin-role",
			testNamespace:        "",
			expectNamespaceError: false,
			expectedKeyContains:  "/resource/globalroles/name/admin-role",
		},
		{
			name:                 "Namespaced resource requires namespace",
			resourceInfo:         namespacedResourceInfo,
			testName:             "viewer-role",
			testNamespace:        "",
			expectNamespaceError: true,
		},
		{
			name:                 "Namespaced resource with namespace succeeds",
			resourceInfo:         namespacedResourceInfo,
			testName:             "editor-role",
			testNamespace:        "default",
			expectNamespaceError: false,
			expectedKeyContains:  "/namespace/default/name/editor-role",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// set up what we expect
			gv := tt.resourceInfo.GroupVersion()
			gv.Version = runtime.APIVersionInternal
			var keyFunc func(ctx context.Context, name string) (string, error)
			if tt.resourceInfo.IsClusterScoped() {
				keyFunc = ClusterScopedKeyFunc(tt.resourceInfo.GroupResource())
			} else {
				keyFunc = NamespaceKeyFunc(tt.resourceInfo.GroupResource())
			}
			ctx := context.Background()
			if tt.testNamespace != "" {
				ctx = genericapirequest.WithNamespace(ctx, tt.testNamespace)
			}

			// now try calling the key function and see if it returns what we expect
			key, err := keyFunc(ctx, tt.testName)
			if tt.expectNamespaceError {
				if err == nil {
					t.Errorf("Expected namespace error but got none")
				} else if !strings.Contains(err.Error(), "Namespace parameter required") {
					t.Errorf("Expected namespace error but got: %v", err)
				}
				return
			}
			if err != nil {
				t.Fatalf("KeyFunc() unexpected error: %v", err)
			}
			if !strings.Contains(key, tt.expectedKeyContains) {
				t.Errorf("KeyFunc() = %q, expected to contain %q", key, tt.expectedKeyContains)
			}

			// cluster scoped resources should not have a namespace in the key
			if tt.resourceInfo.IsClusterScoped() {
				if strings.Contains(key, "/namespace/") {
					t.Errorf("Cluster-scoped resource key %q should not contain namespace", key)
				}
			}

			// namespaced resources with namespace should have the namespace in the key
			if !tt.resourceInfo.IsClusterScoped() && tt.testNamespace != "" {
				if !strings.Contains(key, "/namespace/"+tt.testNamespace) {
					t.Errorf("Namespaced resource key %q should contain namespace %q", key, tt.testNamespace)
				}
			}
		})
	}
}

type mockObject struct {
	metav1.TypeMeta
	metav1.ObjectMeta
}

func (m *mockObject) DeepCopyObject() runtime.Object {
	return &mockObject{
		TypeMeta:   m.TypeMeta,
		ObjectMeta: *m.DeepCopy(),
	}
}

type mockObjectList struct {
	metav1.TypeMeta
	metav1.ListMeta
	Items []mockObject
}

func (m *mockObjectList) DeepCopyObject() runtime.Object {
	out := &mockObjectList{
		TypeMeta: m.TypeMeta,
		ListMeta: *m.DeepCopy(),
	}
	if m.Items != nil {
		out.Items = make([]mockObject, len(m.Items))
		copy(out.Items, m.Items)
	}
	return out
}
