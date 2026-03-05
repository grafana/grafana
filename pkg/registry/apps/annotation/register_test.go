package annotation

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
)

func TestK8sRESTAdapter_Create_GenerateName(t *testing.T) {
	ctx := t.Context()

	cfg := &setting.Cfg{}
	nsMapper := request.GetNamespaceMapper(cfg)

	store := NewMemoryStore()
	adapter := &k8sRESTAdapter{
		store:  store,
		mapper: nsMapper,
	}

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

	t.Run("generateName takes precedence over name", func(t *testing.T) {
		anno := &annotationV0.Annotation{
			ObjectMeta: metav1.ObjectMeta{
				Name:         "my-annotation-name",
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

		// When both are provided, generateName takes priority
		assert.True(t, strings.HasPrefix(result.Name, "generated-"),
			"expected name to be generated from generateName prefix")
		assert.NotEqual(t, "my-annotation-name", result.Name,
			"explicit name should be overridden when generateName is present")
	})
}
