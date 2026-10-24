package collections

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

type failingStarsStorage struct {
	grafanarest.Storage
	err error
}

func (s *failingStarsStorage) Get(context.Context, string, *v1.GetOptions) (runtime.Object, error) {
	return nil, s.err
}

type starsTestResponder struct {
	err error
}

func (r *starsTestResponder) Object(int, runtime.Object) {}
func (r *starsTestResponder) Error(err error)            { r.err = err }

func TestStarsWritePreservesGetError(t *testing.T) {
	for _, method := range []string{http.MethodPut, http.MethodDelete} {
		t.Run(method, func(t *testing.T) {
			getErr := errors.New("star query failed")
			responder := &starsTestResponder{}
			ctx := request.WithNamespace(context.Background(), "default")
			handler, err := (&starsREST{store: &failingStarsStorage{err: getErr}}).Connect(ctx, "user-alice", nil, responder)
			require.NoError(t, err)

			url := "/apis/collections.grafana.app/v1alpha1/namespaces/default/stars/user-alice/update/dashboard.grafana.app/Dashboard/abc"
			handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(method, url, nil))

			require.ErrorIs(t, responder.err, getErr)
		})
	}
}

func TestStarsWrite(t *testing.T) {
	t.Run("path", func(t *testing.T) {
		tests := []struct {
			name   string
			url    string
			prefix string
			item   starItem
			err    string
		}{{
			name:   "normal",
			url:    "http://localhost:3000/apis/collections.grafana.app/v1alpha1/namespaces/default/stars/user-abc/write/dashboard.grafana.app/Dashboard/000000127",
			prefix: "/user-abc/write",
			item: starItem{
				group: "dashboard.grafana.app",
				kind:  "Dashboard",
				id:    "000000127",
			},
		}, {
			name:   "prefix not found",
			url:    "http://localhost:3000/apis/collections.grafana.app/v1alpha1/namespaces/default/stars/user-abc/write/dashboard.grafana.app/Dashboard/000000127",
			prefix: "/something/write",
			err:    "invalid request path",
		}, {
			name:   "missing three parts",
			url:    "http://localhost:3000/apis/collections.grafana.app/v1alpha1/namespaces/default/stars/user-abc/write/dashboard.grafana.app/000000127",
			prefix: "/user-abc/write",
			err:    "expected {group}/{kind}/{id}",
		}}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				item, err := itemFromPath(tt.url, tt.prefix)
				if tt.err == "" {
					require.NoError(t, err)
					require.Equal(t, tt.item, item)
				} else {
					require.ErrorContains(t, err, tt.err)
				}
			})
		}
	})
}
