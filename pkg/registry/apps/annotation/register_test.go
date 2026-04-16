package annotation

import (
	"strings"
	"testing"

	authtypes "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestK8sRESTAdapter_Create(t *testing.T) {
	const userUID = "test-user-uid-123"
	ctx := identity.WithRequester(t.Context(), &identity.StaticRequester{
		Type:    authtypes.TypeUser,
		UserUID: userUID,
		OrgID:   1,
	})

	store := NewMemoryStore()
	adapter := &k8sRESTAdapter{
		store:        store,
		accessClient: authtypes.FixedAccessClient(true),
	}

	expectedCreatedBy := authtypes.NewTypeID(authtypes.TypeUser, userUID)

	t.Run("should generate name from generateName", func(t *testing.T) {
		anno := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{
				GenerateName: "test-anno-",
				Namespace:    "default",
			},
			Spec: annotationV0.AnnotationSpec{
				Text: "test annotation",
				Time: 12345,
			},
		}

		created, err := adapter.Create(ctx, anno, nil, nil)
		require.NoError(t, err)
		require.NotNil(t, created)

		result := created.(*annotationV0.Annotation)

		// Name should start with the generateName prefix and have a random suffix appended
		assert.True(t, strings.HasPrefix(result.Name, "test-anno-"),
			"expected name to start with prefix 'test-anno-', got: %s", result.Name)
		assert.Greater(t, len(result.Name), len("test-anno-"),
			"expected name to have random suffix appended")
		assert.Equal(t, expectedCreatedBy, result.GetCreatedBy())
	})

	t.Run("should accept explicit name", func(t *testing.T) {
		anno := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-annotation-name",
				Namespace: "default",
			},
			Spec: annotationV0.AnnotationSpec{
				Text: "test annotation with explicit name",
				Time: 12345,
			},
		}

		created, err := adapter.Create(ctx, anno, nil, nil)
		require.NoError(t, err)
		require.NotNil(t, created)

		result := created.(*annotationV0.Annotation)
		assert.Equal(t, "my-annotation-name", result.Name,
			"expected name to match the provided name")
		assert.Equal(t, expectedCreatedBy, result.GetCreatedBy())
	})

	t.Run("should reject when both name and generateName are empty", func(t *testing.T) {
		anno := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "default",
			},
			Spec: annotationV0.AnnotationSpec{
				Text: "test annotation",
				Time: 12345,
			},
		}

		_, err := adapter.Create(ctx, anno, nil, nil)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "metadata.name or metadata.generateName is required",
			"expected error message about missing name/generateName")
	})

	t.Run("should return error when identity is not in context", func(t *testing.T) {
		anno := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "anno-no-identity",
				Namespace: "default",
			},
			Spec: annotationV0.AnnotationSpec{
				Text: "test annotation",
				Time: 12345,
			},
		}

		_, err := adapter.Create(t.Context(), anno, nil, nil)
		require.Error(t, err)
	})

	t.Run("name takes precedence over generateName", func(t *testing.T) {
		anno := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{
				Name:         "my-special-name",
				GenerateName: "generated-",
				Namespace:    "default",
			},
			Spec: annotationV0.AnnotationSpec{
				Text: "test annotation",
				Time: 12345,
			},
		}

		created, err := adapter.Create(ctx, anno, nil, nil)
		require.NoError(t, err)
		require.NotNil(t, created)

		result := created.(*annotationV0.Annotation)

		// When both are provided, name takes priority
		assert.Equal(t, "my-special-name", result.Name,
			"expected name to match the provided name, not the generateName")
		assert.Equal(t, expectedCreatedBy, result.GetCreatedBy())
	})
}

func TestK8sRESTAdapter_TenantIsolation(t *testing.T) {
	store := NewMemoryStore()
	adapter := &k8sRESTAdapter{
		store:        store,
		accessClient: authtypes.FixedAccessClient(true),
	}

	// Create annotations in different namespaces (tenants)
	namespace1 := "org-1"
	namespace2 := "org-2"

	ctx1 := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), namespace1)
	ctx2 := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 2), namespace2)

	t.Run("annotations are isolated by namespace", func(t *testing.T) {
		// Create annotation in namespace1
		anno1 := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "anno-1",
				Namespace: namespace1,
			},
			Spec: annotationV0.AnnotationSpec{
				Text: "annotation in org 1",
				Time: 12345,
			},
		}
		_, err := adapter.Create(ctx1, anno1, nil, nil)
		require.NoError(t, err)

		// Create annotation in namespace2
		anno2 := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "anno-2",
				Namespace: namespace2,
			},
			Spec: annotationV0.AnnotationSpec{
				Text: "annotation in org 2",
				Time: 12346,
			},
		}
		_, err = adapter.Create(ctx2, anno2, nil, nil)
		require.NoError(t, err)

		// List from namespace1 should only see anno1
		list1, err := adapter.List(ctx1, &metainternalversion.ListOptions{})
		require.NoError(t, err)
		annoList1 := list1.(*annotationV0.AnnotationList)
		assert.Len(t, annoList1.Items, 1)
		assert.Equal(t, "anno-1", annoList1.Items[0].Name)
		assert.Equal(t, namespace1, annoList1.Items[0].Namespace)

		// List from namespace2 should only see anno2
		list2, err := adapter.List(ctx2, &metainternalversion.ListOptions{})
		require.NoError(t, err)
		annoList2 := list2.(*annotationV0.AnnotationList)
		assert.Len(t, annoList2.Items, 1)
		assert.Equal(t, "anno-2", annoList2.Items[0].Name)
		assert.Equal(t, namespace2, annoList2.Items[0].Namespace)
	})

	t.Run("get fails when accessing annotation from different namespace", func(t *testing.T) {
		// Create annotation in namespace1
		anno := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "cross-ns-test",
				Namespace: namespace1,
			},
			Spec: annotationV0.AnnotationSpec{
				Text: "test annotation",
				Time: 12347,
			},
		}
		_, err := adapter.Create(ctx1, anno, nil, nil)
		require.NoError(t, err)

		// Try to get from namespace1 (should succeed)
		retrieved1, err := adapter.Get(ctx1, "cross-ns-test", nil)
		require.NoError(t, err)
		assert.Equal(t, "cross-ns-test", retrieved1.(*annotationV0.Annotation).Name)

		// Try to get from namespace2 (should fail - not found)
		_, err = adapter.Get(ctx2, "cross-ns-test", nil)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "not found")
	})

	t.Run("update enforces namespace consistency", func(t *testing.T) {
		// Create annotation in namespace1
		anno := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "update-test",
				Namespace: namespace1,
			},
			Spec: annotationV0.AnnotationSpec{
				Text: "original text",
				Time: 12348,
			},
		}
		_, err := adapter.Create(ctx1, anno, nil, nil)
		require.NoError(t, err)

		// Try to update with mismatched namespace in body
		updatedAnno := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "update-test",
				Namespace: namespace2, // Wrong namespace!
			},
			Spec: annotationV0.AnnotationSpec{
				Text: "updated text",
				Time: 12348,
			},
		}

		// Update should fail due to namespace mismatch
		_, _, err = adapter.Update(ctx1, "update-test", rest.DefaultUpdatedObjectInfo(updatedAnno), nil, nil, false, nil)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "namespace")
	})

	t.Run("delete is isolated by namespace", func(t *testing.T) {
		// Create annotation in namespace1
		anno := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "delete-test",
				Namespace: namespace1,
			},
			Spec: annotationV0.AnnotationSpec{
				Text: "to be deleted",
				Time: 12349,
			},
		}
		_, err := adapter.Create(ctx1, anno, nil, nil)
		require.NoError(t, err)

		// Try to delete from namespace2 (should fail)
		_, _, err = adapter.Delete(ctx2, "delete-test", nil, nil)
		require.Error(t, err)

		// Verify annotation still exists in namespace1
		retrieved, err := adapter.Get(ctx1, "delete-test", nil)
		require.NoError(t, err)
		assert.Equal(t, "delete-test", retrieved.(*annotationV0.Annotation).Name)

		// Delete from namespace1 (should succeed)
		_, _, err = adapter.Delete(ctx1, "delete-test", nil, nil)
		require.NoError(t, err)

		// Verify it's gone
		_, err = adapter.Get(ctx1, "delete-test", nil)
		require.Error(t, err)
	})
}

func TestK8sRESTAdapter_NotFound(t *testing.T) {
	store := NewMemoryStore()
	adapter := &k8sRESTAdapter{
		store:        store,
		accessClient: authtypes.FixedAccessClient(true),
	}

	ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), "default")

	t.Run("get returns k8s NotFound for nonexistent annotation", func(t *testing.T) {
		_, err := adapter.Get(ctx, "does-not-exist", nil)
		require.Error(t, err)
		assert.True(t, apierrors.IsNotFound(err), "expected IsNotFound, got: %v", err)
	})

	t.Run("update returns k8s NotFound for nonexistent annotation", func(t *testing.T) {
		updated := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "does-not-exist",
				Namespace: "default",
			},
			Spec: annotationV0.AnnotationSpec{
				Text: "updated text",
				Time: 12345,
			},
		}
		_, _, err := adapter.Update(ctx, "does-not-exist", rest.DefaultUpdatedObjectInfo(updated), nil, nil, false, nil)
		require.Error(t, err)
		assert.True(t, apierrors.IsNotFound(err), "expected IsNotFound, got: %v", err)
	})

	t.Run("delete returns k8s NotFound for nonexistent annotation", func(t *testing.T) {
		_, _, err := adapter.Delete(ctx, "does-not-exist", nil, nil)
		require.Error(t, err)
		assert.True(t, apierrors.IsNotFound(err), "expected IsNotFound, got: %v", err)
	})
}
