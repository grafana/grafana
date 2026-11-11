package userk8s

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSignedInUserCacheSharesResourceAcrossOrgs(t *testing.T) {
	var calls atomic.Int32
	svc, ctx := setupServiceAndCtx(t, svcTestSetup{
		cfg: &setting.Cfg{StackID: "123"},
		serverResponse: func(w http.ResponseWriter, r *http.Request) {
			calls.Add(1)
			serveCachedUser(w, r)
		},
	})
	for _, orgID := range []int64{1, 2, 1} {
		got, err := svc.GetSignedInUser(ctx, &user.GetSignedInUserQuery{UserUID: "12345", OrgID: orgID})
		require.NoError(t, err)
		require.Equal(t, orgID, got.OrgID)
		require.Equal(t, "12345", got.UserUID)
		require.Equal(t, "jdoe", got.Login)
		got.OrgID = 99
		got.Login = "modified"
	}
	require.Equal(t, int32(1), calls.Load())
	namespace := svc.namespaceMapper(1)
	key := signedInUserCacheKey(namespace, "12345")
	cached, expires, found := svc.cache.GetWithExpiration(key)
	require.True(t, found)
	require.IsType(t, &v0alpha1.User{}, cached)
	require.Equal(t, namespace, cached.(*v0alpha1.User).Namespace)
	require.WithinDuration(t, time.Now().Add(signedInUserCacheTTL), expires, time.Second)

	raw, err := svc.getCachedSignedInUserResource(ctx, namespace, &user.GetSignedInUserQuery{UserUID: "12345"})
	require.NoError(t, err)
	raw.Labels["grafana.app/deprecatedInternalID"] = "99"
	raw.Spec.Login = "modified"
	raw, err = svc.getCachedSignedInUserResource(ctx, namespace, &user.GetSignedInUserQuery{UserUID: "12345"})
	require.NoError(t, err)
	require.Equal(t, "42", raw.Labels["grafana.app/deprecatedInternalID"])
	require.Equal(t, "jdoe", raw.Spec.Login)
	require.Equal(t, int32(1), calls.Load())
}

func TestSignedInUserCacheSeparatesNamespacesAndUIDs(t *testing.T) {
	var calls atomic.Int32
	svc, ctx := setupServiceAndCtx(t, svcTestSetup{
		serverResponse: func(w http.ResponseWriter, r *http.Request) {
			calls.Add(1)
			serveCachedUser(w, r)
		},
	})
	for range 2 {
		for _, query := range []*user.GetSignedInUserQuery{
			{UserID: 42, OrgID: 1},
			{UserID: 42, OrgID: 2},
			{UserUID: "12345", OrgID: 1},
			{UserUID: "12345", OrgID: 2},
			{UserUID: "other-uid", OrgID: 1},
		} {
			got, err := svc.GetSignedInUser(ctx, query)
			require.NoError(t, err)
			if query.UserUID != "" {
				require.Equal(t, query.UserUID, got.UserUID)
			} else {
				require.Equal(t, "12345", got.UserUID)
			}
			require.Equal(t, query.OrgID, got.OrgID)
			require.Equal(t, svc.namespaceMapper(query.OrgID), got.Name)
		}
	}
	require.Equal(t, int32(3), calls.Load())
}

func TestSignedInUserCacheNumericIDMappingAndExpiry(t *testing.T) {
	var lists, gets atomic.Int32
	svc, ctx := setupServiceAndCtx(t, svcTestSetup{
		cfg: &setting.Cfg{StackID: "123"},
		serverResponse: func(w http.ResponseWriter, r *http.Request) {
			if path.Base(r.URL.Path) == "users" {
				lists.Add(1)
			} else {
				gets.Add(1)
			}
			serveCachedUser(w, r)
		},
	})
	for _, query := range []*user.GetSignedInUserQuery{
		{UserID: 42, OrgID: 1}, {UserID: 42, OrgID: 2}, {UserUID: "12345", OrgID: 1},
	} {
		got, err := svc.GetSignedInUser(ctx, query)
		require.NoError(t, err)
		require.Equal(t, int64(42), got.UserID)
		require.Equal(t, query.OrgID, got.OrgID)
	}
	require.Equal(t, int32(1), lists.Load())
	require.Zero(t, gets.Load())
	namespace := svc.namespaceMapper(1)
	key := signedInUserCacheKey(namespace, "12345")
	svc.cache.Set(key, &v0alpha1.User{}, time.Nanosecond)
	require.Eventually(t, func() bool { _, found := svc.cache.Get(key); return !found }, time.Second, time.Millisecond)
	_, err := svc.GetSignedInUser(ctx, &user.GetSignedInUserQuery{UserID: 42, OrgID: 1})
	require.NoError(t, err)
	require.Equal(t, int32(1), lists.Load())
	require.Equal(t, int32(1), gets.Load(), "the UID mapping avoids another index search")
	svc.cache.Flush()
	_, err = svc.GetSignedInUser(ctx, &user.GetSignedInUserQuery{UserID: 42, OrgID: 1})
	require.NoError(t, err)
	require.Equal(t, int32(2), lists.Load())
}

func TestSignedInUserCacheDoesNotCacheErrors(t *testing.T) {
	var calls atomic.Int32
	svc, ctx := setupServiceAndCtx(t, svcTestSetup{
		serverResponse: func(w http.ResponseWriter, r *http.Request) {
			calls.Add(1)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(metav1.Status{
				TypeMeta: metav1.TypeMeta{APIVersion: "v1", Kind: "Status"},
				Status:   metav1.StatusFailure, Code: http.StatusNotFound, Reason: metav1.StatusReasonNotFound,
			})
		},
	})
	for range 2 {
		_, err := svc.GetSignedInUser(ctx, &user.GetSignedInUserQuery{UserUID: "12345", OrgID: 1})
		require.ErrorIs(t, err, user.ErrUserNotFound)
	}
	require.Equal(t, int32(2), calls.Load())
	require.Zero(t, svc.cache.ItemCount())
}

func TestSignedInUserCacheConcurrentRequests(t *testing.T) {
	var calls atomic.Int32
	svc, ctx := setupServiceAndCtx(t, svcTestSetup{
		serverResponse: func(w http.ResponseWriter, r *http.Request) {
			calls.Add(1)
			serveCachedUser(w, r)
		},
	})
	var wg sync.WaitGroup
	start := make(chan struct{})
	for range 20 {
		wg.Go(func() {
			<-start
			got, err := svc.GetSignedInUser(ctx, &user.GetSignedInUserQuery{UserID: 42, OrgID: 1})
			if assert.NoError(t, err) {
				assert.Equal(t, "jdoe", got.Login)
				got.Login = "modified"
			}
		})
	}
	close(start)
	wg.Wait()
	require.Equal(t, int32(1), calls.Load())
}

func TestSignedInUserCacheCallerCancellation(t *testing.T) {
	svc, ctx := setupServiceAndCtx(t, svcTestSetup{nilProvider: true})
	synctest.Test(t, func(t *testing.T) {
		release := make(chan struct{})
		defer close(release)
		calls := 0
		var fetchCtx context.Context
		svc.configProvider = &testDirectRestConfigProvider{
			serverURL: "http://user-cache.test",
			transport: userCacheRoundTripper(func(r *http.Request) (*http.Response, error) {
				calls++
				fetchCtx = r.Context()
				select {
				case <-release:
					recorder := httptest.NewRecorder()
					serveCachedUser(recorder, r)
					return recorder.Result(), nil
				case <-r.Context().Done():
					return nil, r.Context().Err()
				}
			}),
		}
		callerCtx, cancel := context.WithCancel(ctx)
		defer cancel()
		query := &user.GetSignedInUserQuery{UserUID: "12345", OrgID: 1}
		first := make(chan error, 1)
		go func() {
			_, err := svc.GetSignedInUser(callerCtx, query)
			first <- err
		}()
		synctest.Wait()
		require.Equal(t, 1, calls)

		second := make(chan error, 1)
		go func() {
			_, err := svc.GetSignedInUser(ctx, query)
			second <- err
		}()
		// Both callers are waiting on the same fetch before the initiating caller cancels.
		synctest.Wait()
		require.Equal(t, 1, calls)
		cancel()
		synctest.Wait()
		require.ErrorIs(t, <-first, context.Canceled)
		require.NoError(t, fetchCtx.Err())
		select {
		case err := <-second:
			t.Fatalf("waiting caller returned before the fetch completed: %v", err)
		default:
		}

		release <- struct{}{}
		synctest.Wait()
		require.NoError(t, <-second)
		require.Equal(t, 1, calls)
	})
}

func TestSignedInUserCacheFetchTimeoutAndRetry(t *testing.T) {
	svc, ctx := setupServiceAndCtx(t, svcTestSetup{nilProvider: true})
	synctest.Test(t, func(t *testing.T) {
		calls := 0
		svc.configProvider = &testDirectRestConfigProvider{
			serverURL: "http://user-cache.test",
			transport: userCacheRoundTripper(func(r *http.Request) (*http.Response, error) {
				calls++
				if calls == 1 {
					<-r.Context().Done()
					return nil, r.Context().Err()
				}
				recorder := httptest.NewRecorder()
				serveCachedUser(recorder, r)
				return recorder.Result(), nil
			}),
		}
		query := &user.GetSignedInUserQuery{UserUID: "12345", OrgID: 1}
		done := make(chan error, 1)
		go func() {
			_, err := svc.GetSignedInUser(ctx, query)
			done <- err
		}()
		synctest.Wait()
		require.Equal(t, 1, calls)
		select {
		case err := <-done:
			t.Fatalf("fetch returned before its deadline: %v", err)
		default:
		}

		time.Sleep(signedInUserFetchTimeout)
		synctest.Wait()
		require.ErrorIs(t, <-done, context.DeadlineExceeded)
		require.NoError(t, ctx.Err(), "the timeout belongs to the shared fetch")
		require.Zero(t, svc.cache.ItemCount(), "a timed-out fetch must not populate the cache")

		got, err := svc.GetSignedInUser(ctx, query)
		require.NoError(t, err)
		require.Equal(t, "12345", got.UserUID)
		require.Equal(t, 2, calls, "retry must start a new fetch")
		got, err = svc.GetSignedInUser(ctx, query)
		require.NoError(t, err)
		require.Equal(t, "12345", got.UserUID)
		require.Equal(t, 2, calls, "successful retry must populate the cache")
	})
}

type userCacheRoundTripper func(*http.Request) (*http.Response, error)

func (f userCacheRoundTripper) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

func serveCachedUser(w http.ResponseWriter, r *http.Request) {
	namespace := strings.Split(r.URL.Path, "/")[5]
	uid := path.Base(r.URL.Path)
	list := uid == "users"
	if list {
		uid = "12345"
	}
	item := v0alpha1.User{
		TypeMeta:   metav1.TypeMeta{APIVersion: v0alpha1.GroupVersion.Identifier(), Kind: "User"},
		ObjectMeta: metav1.ObjectMeta{Name: uid, Namespace: namespace, Labels: map[string]string{"grafana.app/deprecatedInternalID": "42"}},
		Spec:       v0alpha1.UserSpec{Login: "jdoe", Title: namespace, Role: "Viewer"},
	}
	w.Header().Set("Content-Type", "application/json")
	if list {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"apiVersion": v0alpha1.GroupVersion.Identifier(), "kind": "UserList", "items": []v0alpha1.User{item},
		})
	} else {
		_ = json.NewEncoder(w).Encode(item)
	}
}
