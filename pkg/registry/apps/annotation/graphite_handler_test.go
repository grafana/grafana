package annotation

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	authtypes "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

func TestGraphiteHandler(t *testing.T) {
	ctx := identity.WithServiceIdentityContext(t.Context(), 1)
	allowAll := &fakeAccessClient{fn: func(authtypes.BatchCheckItem) bool { return true }}

	// run drives the handler against the given adapter and decodes the response body
	// (the created Annotation) when the call succeeds.
	run := func(t *testing.T, adapter *k8sRESTAdapter, body string) (annotationV0.Annotation, error) {
		t.Helper()
		handler := newGraphiteHandler(adapter, tracing.InitializeTracerForTest(), ProvideMetrics(nil), log.NewNopLogger())
		writer := &mockResponseWriter{header: make(http.Header), body: &bytes.Buffer{}}
		err := handler(ctx, writer, newGraphiteRequest(body))
		var resp annotationV0.Annotation
		if err == nil {
			require.NoError(t, json.Unmarshal(writer.body.Bytes(), &resp))
		}
		return resp, err
	}

	t.Run("creates an annotation from the graphite format", func(t *testing.T) {
		resp, err := run(t, newTestAdapter(NewMemoryStore(), allowAll), `{"what":"deploy","when":1700000000,"data":"v1.2.3","tags":["release","prod"]}`)
		require.NoError(t, err)
		assert.Equal(t, "deploy\nv1.2.3", resp.Spec.Text)
		assert.Equal(t, int64(1700000000000), resp.Spec.Time)
		assert.Equal(t, []string{"release", "prod"}, resp.Spec.Tags)
		assert.Equal(t, metav1.NamespaceDefault, resp.GetNamespace())
		assert.NotEmpty(t, resp.GetName())
		assert.Equal(t, "Annotation", resp.Kind)
		assert.Equal(t, "annotation.grafana.app/v0alpha1", resp.APIVersion)
	})

	t.Run("text is just what when data is empty", func(t *testing.T) {
		resp, err := run(t, newTestAdapter(NewMemoryStore(), allowAll), `{"what":"deploy","tags":[]}`)
		require.NoError(t, err)
		assert.Equal(t, "deploy", resp.Spec.Text)
	})

	t.Run("parses tags as space-separated string", func(t *testing.T) {
		resp, err := run(t, newTestAdapter(NewMemoryStore(), allowAll), `{"what":"deploy","tags":"release prod"}`)
		require.NoError(t, err)
		assert.Equal(t, []string{"release", "prod"}, resp.Spec.Tags)
	})

	t.Run("empty tags string yields no tags", func(t *testing.T) {
		resp, err := run(t, newTestAdapter(NewMemoryStore(), allowAll), `{"what":"deploy","tags":""}`)
		require.NoError(t, err)
		assert.Empty(t, resp.Spec.Tags)
	})

	t.Run("when defaults to 0", func(t *testing.T) {
		resp, err := run(t, newTestAdapter(NewMemoryStore(), allowAll), `{"what":"deploy","tags":[]}`)
		require.NoError(t, err)
		assert.Equal(t, int64(0), resp.Spec.Time)
	})

	t.Run("rejects empty what", func(t *testing.T) {
		_, err := run(t, newTestAdapter(NewMemoryStore(), allowAll), `{"what":""}`)
		require.Error(t, err)
		assert.True(t, apierrors.IsBadRequest(err))
	})

	t.Run("rejects malformed json", func(t *testing.T) {
		_, err := run(t, newTestAdapter(NewMemoryStore(), allowAll), `not json`)
		require.Error(t, err)
		assert.True(t, apierrors.IsBadRequest(err))
	})

	t.Run("rejects non-string tag in array", func(t *testing.T) {
		_, err := run(t, newTestAdapter(NewMemoryStore(), allowAll), `{"what":"deploy","tags":["ok",123]}`)
		require.Error(t, err)
		assert.True(t, apierrors.IsBadRequest(err))
	})

	t.Run("rejects missing tags", func(t *testing.T) {
		_, err := run(t, newTestAdapter(NewMemoryStore(), allowAll), `{"what":"deploy"}`)
		require.Error(t, err)
		assert.True(t, apierrors.IsBadRequest(err))
	})

	t.Run("propagates the adapter's error when unauthorized", func(t *testing.T) {
		denyAll := &fakeAccessClient{fn: func(authtypes.BatchCheckItem) bool { return false }}
		_, err := run(t, newTestAdapter(NewMemoryStore(), denyAll), `{"what":"deploy","tags":[]}`)
		require.Error(t, err)
		assert.True(t, apierrors.IsForbidden(err))
	})
}

func newGraphiteRequest(body string) *app.CustomRouteRequest {
	return &app.CustomRouteRequest{
		ResourceIdentifier: resource.FullIdentifier{Namespace: metav1.NamespaceDefault},
		Method:             http.MethodPost,
		Body:               io.NopCloser(strings.NewReader(body)),
	}
}
