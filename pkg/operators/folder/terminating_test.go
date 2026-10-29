package folder

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
)

func TestIsTerminating(t *testing.T) {
	bodies := map[string]string{
		"/apis/folder.grafana.app/v1/namespaces/ns/folders/gone":  `{"metadata":{"name":"gone","deletionTimestamp":"2026-10-29T00:00:00Z","finalizers":["f"]}}`,
		"/apis/folder.grafana.app/v1/namespaces/ns/folders/alive": `{"metadata":{"name":"alive","finalizers":["f"]}}`,
		"/apis/folder.grafana.app/v1/namespaces/ns/folders/done":  `{"metadata":{"name":"done","deletionTimestamp":"2026-10-29T00:00:00Z"}}`,
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, ok := bodies[r.URL.Path]
		if !ok {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	gv := folderGVR.GroupVersion()
	client, err := rest.RESTClientFor(&rest.Config{
		Host: srv.URL, APIPath: "/apis",
		ContentConfig: rest.ContentConfig{GroupVersion: &gv, NegotiatedSerializer: scheme.Codecs.WithoutConversion()},
	})
	require.NoError(t, err)

	for name, want := range map[string]bool{"gone": true, "alive": false, "done": false} {
		got, err := isTerminating(t.Context(), client, "ns", name)
		require.NoError(t, err, name)
		require.Equal(t, want, got, name)
	}
	_, err = isTerminating(t.Context(), client, "ns", "missing")
	require.Error(t, err)
}
