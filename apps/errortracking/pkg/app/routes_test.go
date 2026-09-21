package app

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	authlib "github.com/grafana/authlib/types"
	sdkapp "github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/stretchr/testify/require"
)

type testStore struct{}

func (testStore) InsertEvent(context.Context, string, string, string, string, string, int64) error {
	return nil
}
func (testStore) ListEvents(context.Context, string, time.Time, time.Time, int) ([]Event, error) {
	return nil, nil
}

func TestTimeRange(t *testing.T) {
	from, to, limit, err := timeRange(url.Values{"from": {"123"}, "to": {"456"}})
	require.NoError(t, err)
	require.Equal(t, time.UnixMilli(123), from)
	require.Equal(t, time.UnixMilli(456), to)
	require.Equal(t, defaultListLimit, limit)

	before := time.Now()
	malformedFrom, malformedTo, malformedLimit, err := timeRange(url.Values{"from": {"malformed"}})
	require.Error(t, err)
	require.Zero(t, malformedFrom)
	require.Zero(t, malformedTo)
	require.Zero(t, malformedLimit)
	from, to, _, err = timeRange(url.Values{})
	require.NoError(t, err)
	require.WithinRange(t, to, before, time.Now())
	require.Equal(t, time.Hour, to.Sub(from))
}

func TestTimeRangeBounds(t *testing.T) {
	from, to, limit, err := timeRange(url.Values{"limit": {"501"}})
	require.Error(t, err)
	require.Zero(t, from)
	require.Zero(t, to)
	require.Zero(t, limit)
	from, to, limit, err = timeRange(url.Values{"from": {"0"}, "to": {"2678400001"}})
	require.Error(t, err)
	require.Zero(t, from)
	require.Zero(t, to)
	require.Zero(t, limit)
}

func TestEventRouteBoundaries(t *testing.T) {
	application, err := New(sdkapp.Config{SpecificConfig: &Config{Store: testStore{}}})
	require.NoError(t, err)

	for _, tc := range []struct {
		name           string
		body           string
		withIdentity   bool
		wantStatusCode int
	}{
		{name: "valid body passes", body: `{"project":"web","message":"panic"}`, withIdentity: true, wantStatusCode: http.StatusOK},
		{name: "unknown tenant field rejected", body: `{"project":"web","message":"panic","tenant":"other"}`, withIdentity: true, wantStatusCode: http.StatusBadRequest},
		{name: "oversized body", body: strings.Repeat("x", maxRequestBodyBytes+1), withIdentity: true, wantStatusCode: http.StatusRequestEntityTooLarge},
		{name: "invalid occurredAt", body: `{"project":"web","message":"panic","occurredAt":0}`, withIdentity: true, wantStatusCode: http.StatusBadRequest},
		{name: "missing user identity denied", body: `{"project":"web","message":"panic"}`, wantStatusCode: http.StatusUnauthorized},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			if tc.withIdentity {
				ctx = identity.WithRequester(ctx, &identity.StaticRequester{
					Type:      authlib.TypeUser,
					UserUID:   "user-1",
					Namespace: "stacks-123",
				})
			}
			writer := httptest.NewRecorder()
			req := &sdkapp.CustomRouteRequest{
				ResourceIdentifier: resource.FullIdentifier{Group: "error-tracking.grafana.app", Version: "v0alpha1", Namespace: "stacks-123"},
				Path:               "events",
				Method:             http.MethodPost,
				URL:                &url.URL{Path: "/apis/error-tracking.grafana.app/v0alpha1/namespaces/stacks-123/events"},
				Body:               io.NopCloser(strings.NewReader(tc.body)),
			}
			require.NoError(t, application.CallCustomRoute(ctx, writer, req))
			require.Equal(t, tc.wantStatusCode, writer.Code)
		})
	}
}
