package annotation

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestSearchHandler(t *testing.T) {
	ctx := context.Background()

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

	handler := newSearchHandler(store)

	tests := []struct {
		name          string
		queryParams   url.Values
		expectedNames []string
	}{
		{
			name: "Filter by single tag",
			queryParams: url.Values{
				"tag": []string{"tag1"},
			},
			expectedNames: []string{"a-1", "a-4"},
		},
		{
			name: "Filter by multiple tags with matchAny=true (OR)",
			queryParams: url.Values{
				"tag":          []string{"tag1", "tag2"},
				"tagsMatchAny": []string{"true"},
			},
			expectedNames: []string{"a-1", "a-2", "a-4"},
		},
		{
			name: "Filter by multiple tags without matchAny (AND - default)",
			queryParams: url.Values{
				"tag": []string{"tag1", "tag2"},
			},
			expectedNames: []string{"a-4"},
		},
		{
			name: "Filter by three tags with matchAny=true",
			queryParams: url.Values{
				"tag":          []string{"tag1", "tag2", "tag3"},
				"tagsMatchAny": []string{"true"},
			},
			expectedNames: []string{"a-1", "a-2", "a-3", "a-4"},
		},
		{
			name: "Filter by single scope",
			queryParams: url.Values{
				"scope": []string{"scope1"},
			},
			expectedNames: []string{"a-1", "a-4"},
		},
		{
			name: "Filter by multiple scopes with matchAny=true (OR)",
			queryParams: url.Values{
				"scope":          []string{"scope1", "scope2"},
				"scopesMatchAny": []string{"true"},
			},
			expectedNames: []string{"a-1", "a-2", "a-4"},
		},
		{
			name: "Filter by multiple scopes without matchAny (AND - default)",
			queryParams: url.Values{
				"scope": []string{"scope1", "scope2"},
			},
			expectedNames: []string{"a-4"},
		},
		{
			name: "Filter by both tags and scopes",
			queryParams: url.Values{
				"tag":   []string{"tag1"},
				"scope": []string{"scope1"},
			},
			expectedNames: []string{"a-1", "a-4"},
		},
		{
			name: "Filter by tags (OR) and scopes (AND)",
			queryParams: url.Values{
				"tag":          []string{"tag1", "tag2"},
				"tagsMatchAny": []string{"true"},
				"scope":        []string{"scope1", "scope2"},
			},
			expectedNames: []string{"a-4"},
		},
		{
			name: "Invalid tagsMatchAny value (should be ignored, defaults to false)",
			queryParams: url.Values{
				"tag":          []string{"tag1"},
				"tagsMatchAny": []string{"not-valid"},
			},
			expectedNames: []string{"a-1", "a-4"},
		},
		{
			name: "Invalid scopesMatchAny value (should be ignored, defaults to false)",
			queryParams: url.Values{
				"scope":          []string{"scope1"},
				"scopesMatchAny": []string{"not-valid"},
			},
			expectedNames: []string{"a-1", "a-4"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			u := &url.URL{
				Scheme:   "http",
				Host:     "localhost",
				Path:     "/apis/annotation.grafana.app/v0alpha1/namespaces/default/search",
				RawQuery: tt.queryParams.Encode(),
			}

			mockRequest := &app.CustomRouteRequest{
				ResourceIdentifier: resource.FullIdentifier{
					Namespace: metav1.NamespaceDefault,
				},
				URL:    u,
				Method: "GET",
			}

			writer := &mockResponseWriter{
				header: make(http.Header),
				body:   &bytes.Buffer{},
			}

			err := handler(ctx, writer, mockRequest)
			require.NoError(t, err)

			var result annotationV0.AnnotationList
			err = json.Unmarshal(writer.body.Bytes(), &result)
			require.NoError(t, err)

			// verify that the expected annotations were returned
			if len(tt.expectedNames) > 0 {
				resultNames := make([]string, len(result.Items))
				for i, item := range result.Items {
					resultNames[i] = item.Name
				}
				assert.ElementsMatch(t, tt.expectedNames, resultNames, "Result names should match expected names")
			} else if tt.expectedNames != nil {
				assert.Empty(t, result.Items, "Expected no results")
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

// mockResponseWriter implements app.CustomRouteResponseWriter for testing
type mockResponseWriter struct {
	header http.Header
	body   *bytes.Buffer
	code   int
}

func (m *mockResponseWriter) Header() http.Header {
	return m.header
}

func (m *mockResponseWriter) Write(b []byte) (int, error) {
	return m.body.Write(b)
}

func (m *mockResponseWriter) WriteHeader(statusCode int) {
	m.code = statusCode
}
