package annotation

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/url"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
)

func TestTagsHandler(t *testing.T) {
	ctx := t.Context()

	// create several test annotations with different tags in multiple namespaces
	store := NewMemoryStore()
	annotations := []*annotationV0.Annotation{
		// namespace default annotations
		{
			ObjectMeta: metav1.ObjectMeta{Name: "a-1", Namespace: metav1.NamespaceDefault},
			Spec:       annotationV0.AnnotationSpec{Text: "test", Time: 1000, Tags: []string{"deployment", "env-prod"}},
		},
		{
			ObjectMeta: metav1.ObjectMeta{Name: "a-2", Namespace: metav1.NamespaceDefault},
			Spec:       annotationV0.AnnotationSpec{Text: "test", Time: 1000, Tags: []string{"deployment", "env-staging"}},
		},
		{
			ObjectMeta: metav1.ObjectMeta{Name: "a-3", Namespace: metav1.NamespaceDefault},
			Spec:       annotationV0.AnnotationSpec{Text: "test", Time: 1000, Tags: []string{"incident"}},
		},
		{
			ObjectMeta: metav1.ObjectMeta{Name: "a-4", Namespace: metav1.NamespaceDefault},
			Spec:       annotationV0.AnnotationSpec{Text: "test", Time: 1000, Tags: []string{"deployment"}},
		},
		{
			ObjectMeta: metav1.ObjectMeta{Name: "a-5", Namespace: metav1.NamespaceDefault},
			Spec:       annotationV0.AnnotationSpec{Text: "test", Time: 1000, Tags: []string{"release", "env-prod"}},
		},
		// namespace1 annotations
		{
			ObjectMeta: metav1.ObjectMeta{Name: "a-6", Namespace: "namespace1"},
			Spec:       annotationV0.AnnotationSpec{Text: "test", Time: 1000, Tags: []string{"tag1", "tag2"}},
		},
		{
			ObjectMeta: metav1.ObjectMeta{Name: "a-7", Namespace: "namespace1"},
			Spec:       annotationV0.AnnotationSpec{Text: "test", Time: 1000, Tags: []string{"tag1"}},
		},
		// namespace2 annotations
		{
			ObjectMeta: metav1.ObjectMeta{Name: "a-8", Namespace: "namespace2"},
			Spec:       annotationV0.AnnotationSpec{Text: "test", Time: 1000, Tags: []string{"tag3"}},
		},
	}
	for _, anno := range annotations {
		ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(ctx, 1), anno.Namespace)
		_, err := store.Create(ctx, anno)
		require.NoError(t, err)
	}

	handler := newTagsHandler(store.(TagProvider))

	tests := []struct {
		name         string
		namespace    string
		queryParams  url.Values
		expectedTags map[string]int64
		maxResults   int
	}{
		{
			name:        "No filters - returns all tags with default limit",
			namespace:   metav1.NamespaceDefault,
			queryParams: url.Values{},
			expectedTags: map[string]int64{
				"deployment":  3,
				"env-prod":    2,
				"env-staging": 1,
				"incident":    1,
				"release":     1,
			},
		},
		{
			name:      "Filter by prefix matching one tag",
			namespace: metav1.NamespaceDefault,
			queryParams: url.Values{
				"prefix": []string{"inc"},
			},
			expectedTags: map[string]int64{
				"incident": 1,
			},
		},
		{
			name:      "Filter by prefix matching multiple tags",
			namespace: metav1.NamespaceDefault,
			queryParams: url.Values{
				"prefix": []string{"env-"},
			},
			expectedTags: map[string]int64{
				"env-prod":    2,
				"env-staging": 1,
			},
		},
		{
			name:      "Prefix with no matches",
			namespace: metav1.NamespaceDefault,
			queryParams: url.Values{
				"prefix": []string{"nonexistent"},
			},
			expectedTags: map[string]int64{},
		},
		{
			name:      "Limit to 2 results",
			namespace: metav1.NamespaceDefault,
			queryParams: url.Values{
				"limit": []string{"2"},
			},
			maxResults: 2,
		},
		{
			name:      "Invalid limit (not a number) - uses default of 100",
			namespace: metav1.NamespaceDefault,
			queryParams: url.Values{
				"limit": []string{"invalid"},
			},
			expectedTags: map[string]int64{
				"deployment":  3,
				"env-prod":    2,
				"env-staging": 1,
				"incident":    1,
				"release":     1,
			},
		},
		{
			name:      "Prefix and limit combined",
			namespace: metav1.NamespaceDefault,
			queryParams: url.Values{
				"prefix": []string{"env-"},
				"limit":  []string{"1"},
			},
			maxResults: 1,
		},
		{
			name:        "Namespace isolation - namespace1 only sees its own tags",
			namespace:   "namespace1",
			queryParams: url.Values{},
			expectedTags: map[string]int64{
				"tag1": 2,
				"tag2": 1,
			},
		},
		{
			name:        "Namespace isolation - namespace2 only sees its own tags",
			namespace:   "namespace2",
			queryParams: url.Values{},
			expectedTags: map[string]int64{
				"tag3": 1,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			namespace := tt.namespace
			if namespace == "" {
				namespace = metav1.NamespaceDefault
			}

			u := &url.URL{
				Scheme:   "http",
				Host:     "localhost",
				Path:     "/apis/annotation.grafana.app/v0alpha1/namespaces/" + namespace + "/tags",
				RawQuery: tt.queryParams.Encode(),
			}

			mockRequest := &app.CustomRouteRequest{
				ResourceIdentifier: resource.FullIdentifier{
					Namespace: namespace,
				},
				URL:    u,
				Method: "GET",
			}

			writer := &mockResponseWriter{
				header: make(http.Header),
				body:   &bytes.Buffer{},
			}

			ctx := k8srequest.WithNamespace(identity.WithServiceIdentityContext(t.Context(), 1), namespace)
			err := handler(ctx, writer, mockRequest)
			require.NoError(t, err)

			var result tagResponse
			err = json.Unmarshal(writer.body.Bytes(), &result)
			require.NoError(t, err)

			if tt.maxResults > 0 {
				// verify limit was applied
				assert.LessOrEqual(t, len(result.Tags), tt.maxResults, "Result should respect limit")
			}

			if tt.expectedTags != nil {
				// build a map of actual results
				actualTags := make(map[string]int64)
				for _, tag := range result.Tags {
					actualTags[tag.Tag] = tag.Count
				}

				assert.Equal(t, tt.expectedTags, actualTags, "Tags and counts should match expected values")
			}
		})
	}
}
