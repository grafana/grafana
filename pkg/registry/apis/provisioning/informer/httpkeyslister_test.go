package informer

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"

	provisioningapis "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// recordedRequest is what the server saw, so a test can assert the shape the
// endpoint requires rather than only the reply it produced.
type recordedRequest struct {
	method string
	path   string
	opts   metav1.ListOptions
}

// serveKeys stands up an apiserver-shaped endpoint. handler returns the status and
// body for each successive request, so a test can page or degrade mid-stream.
func serveKeys(t *testing.T, handler func(i int, opts metav1.ListOptions) (int, any)) (KeysLister, *[]recordedRequest) {
	t.Helper()
	var seen []recordedRequest

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var opts metav1.ListOptions
		_ = json.NewDecoder(r.Body).Decode(&opts)
		seen = append(seen, recordedRequest{method: r.Method, path: r.URL.Path, opts: opts})

		code, body := handler(len(seen)-1, opts)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(code)
		require.NoError(t, json.NewEncoder(w).Encode(body))
	}))
	t.Cleanup(srv.Close)

	gv := provisioningapis.ConnectionResourceInfo.GroupVersionResource().GroupVersion()
	client, err := rest.RESTClientFor(&rest.Config{
		Host:          srv.URL,
		APIPath:       "/apis",
		ContentConfig: rest.ContentConfig{GroupVersion: &gv, NegotiatedSerializer: scheme.Codecs.WithoutConversion()},
	})
	require.NoError(t, err)

	return NewHTTPConnectionKeysLister(client), &seen
}

func keysPage(rv, cont string, items ...metav1.PartialObjectMetadata) metav1.PartialObjectMetadataList {
	return metav1.PartialObjectMetadataList{
		TypeMeta: metav1.TypeMeta{APIVersion: "meta.k8s.io/v1", Kind: listKeysKind},
		ListMeta: metav1.ListMeta{ResourceVersion: rv, Continue: cont},
		Items:    items,
	}
}

func partial(namespace, name, rv string) metav1.PartialObjectMetadata {
	return metav1.PartialObjectMetadata{ObjectMeta: metav1.ObjectMeta{Namespace: namespace, Name: name, ResourceVersion: rv}}
}

func drain(t *testing.T, lister KeysLister) ([]Key, error) {
	t.Helper()
	_, seq := lister.ListKeys(t.Context())
	var keys []Key
	for k, err := range seq {
		if err != nil {
			return keys, err
		}
		keys = append(keys, k)
	}
	return keys, nil
}

// The endpoint takes a POST with the paging fields and nothing else; it refuses a
// request carrying anything it does not read.
func TestHTTPKeysLister_RequestShape(t *testing.T) {
	lister, seen := serveKeys(t, func(int, metav1.ListOptions) (int, any) {
		return http.StatusOK, keysPage("100", "", partial("ns1", "a", "10"))
	})

	keys, err := drain(t, lister)
	require.NoError(t, err)
	require.Len(t, keys, 1)

	require.Len(t, *seen, 1)
	got := (*seen)[0]
	assert.Equal(t, http.MethodPost, got.method)
	assert.Equal(t, "/apis/provisioning.grafana.app/v0alpha1/connections/list-keys", got.path)
	assert.Equal(t, int64(keysListerPageLimit), got.opts.Limit)
	assert.Empty(t, got.opts.Continue, "the first page carries no token")
	assert.Empty(t, got.opts.LabelSelector, "a selector would be refused by the endpoint")
}

func TestHTTPKeysLister_FollowsContinue(t *testing.T) {
	lister, seen := serveKeys(t, func(i int, _ metav1.ListOptions) (int, any) {
		if i == 0 {
			return http.StatusOK, keysPage("100", "tok", partial("ns1", "a", "10"))
		}
		return http.StatusOK, keysPage("100", "", partial("ns2", "b", "11"))
	})

	listRV, seq := lister.ListKeys(t.Context())
	assert.Equal(t, int64(100), listRV, "the snapshot version comes off the first page")

	var keys []Key
	for k, err := range seq {
		require.NoError(t, err)
		keys = append(keys, k)
	}

	require.Len(t, keys, 2)
	assert.Equal(t, Key{Namespace: "ns1", Name: "a", ResourceVersion: "10"}, keys[0])
	assert.Equal(t, Key{Namespace: "ns2", Name: "b", ResourceVersion: "11"}, keys[1])
	require.Len(t, *seen, 2)
	assert.Equal(t, "tok", (*seen)[1].opts.Continue, "the continue token is forwarded")
}

// The route is mounted only when the server has the endpoint enabled, and a POST to
// an unmounted path resolves to the object handler, so both statuses mean "no
// endpoint here" rather than "your request was wrong".
func TestHTTPKeysLister_TreatsAbsentRouteAsUnsupported(t *testing.T) {
	for name, code := range map[string]int{
		"not found":          http.StatusNotFound,
		"method not allowed": http.StatusMethodNotAllowed,
	} {
		t.Run(name, func(t *testing.T) {
			lister, _ := serveKeys(t, func(int, metav1.ListOptions) (int, any) {
				return code, metav1.Status{Status: metav1.StatusFailure, Code: int32(code)}
			})

			_, err := drain(t, lister)
			require.ErrorIs(t, err, ErrKeysOnlyUnsupported)
		})
	}
}

// A refusal is not an absent endpoint. Falling back on it would turn a
// misconfigured identity into a permanently more expensive re-list, silently.
func TestHTTPKeysLister_SurfacesForbidden(t *testing.T) {
	lister, _ := serveKeys(t, func(int, metav1.ListOptions) (int, any) {
		return http.StatusForbidden, metav1.Status{Status: metav1.StatusFailure, Code: http.StatusForbidden, Reason: metav1.StatusReasonForbidden}
	})

	_, err := drain(t, lister)
	require.Error(t, err)
	assert.NotErrorIs(t, err, ErrKeysOnlyUnsupported, "a 403 must not read as an absent endpoint")
}

// Something else answered the path: a 200 whose body is not the projection.
func TestHTTPKeysLister_RefusesAnotherKind(t *testing.T) {
	lister, _ := serveKeys(t, func(int, metav1.ListOptions) (int, any) {
		return http.StatusOK, map[string]any{"kind": "ConnectionList", "items": []any{}}
	})

	_, err := drain(t, lister)
	require.ErrorIs(t, err, ErrKeysOnlyUnsupported)
}

// An item with no name would key every entry the same in the informer's Store.
func TestHTTPKeysLister_RefusesItemWithoutName(t *testing.T) {
	lister, _ := serveKeys(t, func(int, metav1.ListOptions) (int, any) {
		return http.StatusOK, keysPage("100", "", partial("ns1", "", "10"))
	})

	_, err := drain(t, lister)
	require.ErrorIs(t, err, ErrKeysOnlyUnsupported)
}

// The informer arbitrates its snapshot against the list version, so one it cannot
// read has to fail the tick rather than pass a zero.
func TestHTTPKeysLister_RefusesUnreadableResourceVersion(t *testing.T) {
	lister, _ := serveKeys(t, func(int, metav1.ListOptions) (int, any) {
		return http.StatusOK, keysPage("not-a-number", "", partial("ns1", "a", "10"))
	})

	_, err := drain(t, lister)
	require.Error(t, err)
	assert.NotErrorIs(t, err, ErrKeysOnlyUnsupported, "a broken version is not an absent endpoint")
}
