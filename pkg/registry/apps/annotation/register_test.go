package annotation

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apiserver/pkg/endpoints/request"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	grafrequest "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
)

func TestLegacyStorage_List_FieldSelectors(t *testing.T) {
	ctx := request.WithNamespace(t.Context(), metav1.NamespaceDefault)
	cfg := &setting.Cfg{}
	mapper := grafrequest.GetNamespaceMapper(cfg)

	// create several test annotations with different tags and scopes
	store := NewMemoryStore()
	annotations := []*annotationV0.Annotation{
		createTestAnnotation("a-1", "test", []string{"tag1"}, []string{"scope1"}),
		createTestAnnotation("a-2", "test", []string{"tag2"}, []string{"scope2"}),
		createTestAnnotation("a-3", "test", []string{"tag3"}, []string{"scope3"}),
		createTestAnnotation("a-4", "test", []string{"tag1", "tag2"}, []string{"scope1", "scope2"}),
		createTestAnnotation("a-5", "test", []string{}, []string{}),
	}
	for _, anno := range annotations {
		_, err := store.Create(ctx, anno)
		require.NoError(t, err)
	}

	storage := &legacyStorage{
		store:  store,
		mapper: mapper,
	}

	tests := []struct {
		name          string
		fieldSelector string
		expectError   bool
		expectedNames []string
	}{
		{
			name:          "Filter by single tag",
			fieldSelector: "spec.tags=tag1",
			expectedNames: []string{"a-1", "a-4"},
		},
		{
			name:          "Filter by multiple tags with matchAny=true (OR)",
			fieldSelector: "spec.tags=tag1,spec.tags=tag2,spec.tagsMatchAny=true",
			expectedNames: []string{"a-1", "a-2", "a-4"},
		},
		{
			name:          "Filter by multiple tags without matchAny (AND - default)",
			fieldSelector: "spec.tags=tag1,spec.tags=tag2",
			expectedNames: []string{"a-4"},
		},
		{
			name:          "Filter by three tags with matchAny=true",
			fieldSelector: "spec.tags=tag1,spec.tags=tag2,spec.tags=tag3,spec.tagsMatchAny=true",
			expectedNames: []string{"a-1", "a-2", "a-3", "a-4"},
		},
		{
			name:          "Filter by single scope",
			fieldSelector: "spec.scopes=scope1",
			expectedNames: []string{"a-1", "a-4"},
		},
		{
			name:          "Filter by multiple scopes with matchAny=true (OR)",
			fieldSelector: "spec.scopes=scope1,spec.scopes=scope2,spec.scopesMatchAny=true",
			expectedNames: []string{"a-1", "a-2", "a-4"},
		},
		{
			name:          "Filter by multiple scopes without matchAny (AND - default)",
			fieldSelector: "spec.scopes=scope1,spec.scopes=scope2",
			expectedNames: []string{"a-4"},
		},
		{
			name:          "Filter by both tags and scopes",
			fieldSelector: "spec.tags=tag1,spec.scopes=scope1",
			expectedNames: []string{"a-1", "a-4"},
		},
		{
			name:          "Filter by tags (OR) and scopes (AND)",
			fieldSelector: "spec.tags=tag1,spec.tags=tag2,spec.tagsMatchAny=true,spec.scopes=scope1,spec.scopes=scope2",
			expectedNames: []string{"a-4"},
		},
		{
			name:          "Unsupported operator for tags (!=)",
			fieldSelector: "spec.tags!=tag1",
			expectError:   true,
		},
		{
			name:          "Unsupported operator for scopes (!=)",
			fieldSelector: "spec.scopes!=scope1",
			expectError:   true,
		},
		{
			name:          "Invalid tagsMatchAny value",
			fieldSelector: "spec.tags=tag1,spec.tagsMatchAny=not-valid",
			expectError:   true,
		},
		{
			name:          "Invalid scopesMatchAny value",
			fieldSelector: "spec.scopes=scope1,spec.scopesMatchAny=not-valid",
			expectError:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			selector, err := fields.ParseSelector(tt.fieldSelector)
			require.NoError(t, err)

			listOpts := &internalversion.ListOptions{
				FieldSelector: selector,
			}

			result, err := storage.List(ctx, listOpts)

			if tt.expectError {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			assert.NotNil(t, result)

			annotationList, ok := result.(*annotationV0.AnnotationList)
			require.True(t, ok, "Result should be an AnnotationList")

			// verify that the expected annotations were returned
			if len(tt.expectedNames) > 0 {
				resultNames := make([]string, len(annotationList.Items))
				for i, item := range annotationList.Items {
					resultNames[i] = item.Name
				}
				assert.ElementsMatch(t, tt.expectedNames, resultNames, "Result names should match expected names")
			}
		})
	}
}

func createTestAnnotation(name, text string, tags []string, scopes []string) *annotationV0.Annotation {
	return &annotationV0.Annotation{
		TypeMeta: metav1.TypeMeta{},
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: metav1.NamespaceDefault,
		},
		Spec: annotationV0.AnnotationSpec{
			Text:   text,
			Time:   1000,
			Tags:   tags,
			Scopes: scopes,
		},
	}
}
