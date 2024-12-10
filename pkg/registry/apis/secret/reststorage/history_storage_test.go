package reststorage_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	secret "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/reststorage"
)

func TestHistoryStorageConnect(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	t.Run("when the history store returns a valid history, the http handler responds with it", func(t *testing.T) {
		t.Parallel()

		rr := httptest.NewRecorder()

		historyStore := &fakeStore{}
		responder := &fakeResponder{w: rr}

		storage := reststorage.NewHistoryStorage(historyStore)

		handler, err := storage.Connect(ctx, "name", nil, responder)
		require.NoError(t, err)
		require.NotNil(t, handler)

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, "/", nil)
		require.NoError(t, err)
		require.NotNil(t, req)

		handler.ServeHTTP(rr, req)
		require.Equal(t, http.StatusOK, rr.Code)

		require.Equal(t, 1, historyStore.historyCalls)
		require.Equal(t, 1, responder.objectCalls)
	})

	t.Run("when the history store returns an error, the http handler is `nil` and the error is returned", func(t *testing.T) {
		t.Parallel()

		fakeErr := errors.New("some error")
		historyStore := &fakeStore{historyErr: fakeErr}

		storage := reststorage.NewHistoryStorage(historyStore)

		handler, err := storage.Connect(ctx, "name", nil, nil)
		require.ErrorIs(t, err, fakeErr)
		require.Nil(t, handler)
	})
}

type fakeResponder struct {
	w           http.ResponseWriter
	objectCalls int
	m           sync.Mutex
}

func (r *fakeResponder) Object(statusCode int, obj runtime.Object) {
	r.m.Lock()
	r.objectCalls++
	r.m.Unlock()

	r.w.WriteHeader(statusCode)
}

func (r *fakeResponder) Error(err error) {}

type fakeStore struct {
	historyErr   error
	historyCalls int
	m            sync.Mutex
}

func (s *fakeStore) History(ctx context.Context, ns string, name string, continueToken string) (*secret.SecureValueActivityList, error) {
	s.m.Lock()
	s.historyCalls++
	s.m.Unlock()

	if s.historyErr != nil {
		return nil, s.historyErr
	}

	return &secret.SecureValueActivityList{
		Items: []secret.SecureValueActivity{
			{Timestamp: 1, Action: "create", Identity: "user", Details: "details"},
		},
	}, nil
}
