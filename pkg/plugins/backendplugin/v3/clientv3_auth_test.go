package v3

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"

	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestNewTokenExchanger(t *testing.T) {
	for _, tt := range []struct {
		name, token, url string
	}{
		{name: "token only", token: "cap-token"},
		{name: "exchange URL only", url: "https://auth.example.com/v1/sign-access-token"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			exchanger, err := NewTokenExchanger(tt.token, tt.url)
			require.ErrorContains(t, err, "must be set together")
			require.Nil(t, exchanger)
		})
	}

	t.Run("not configured", func(t *testing.T) {
		exchanger, err := NewTokenExchanger("", "")
		require.NoError(t, err)
		require.Nil(t, exchanger, "without both values, requests are not authenticated")

		client := &recordingClientV3{}
		wrapped, err := WithAuthentication(client, "example-app", exchanger)
		require.NoError(t, err)
		require.Same(t, client, wrapped)
	})

	wrapped, err := WithAuthentication(nil, "example-app", authnlib.NewStaticTokenExchanger("token"))
	require.NoError(t, err)
	require.Nil(t, wrapped, "a missing client stays missing")
}

func TestWithAuthenticationExchangesForCaller(t *testing.T) {
	var exchanged []map[string]any
	signer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "Bearer cap-token", r.Header.Get("Authorization"))
		var req map[string]any
		require.NoError(t, json.NewDecoder(r.Body).Decode(&req))
		exchanged = append(exchanged, req)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"data":{"token":"exchanged-token"}}`)
	}))
	defer signer.Close()

	exchanger, err := NewTokenExchanger("cap-token", signer.URL)
	require.NoError(t, err)
	require.NotNil(t, exchanger)

	for _, tt := range []struct {
		name        string
		ctx         context.Context
		wantSubject any
		wantNS      string
	}{
		{
			name:        "user is exchanged on behalf of",
			ctx:         identity.WithRequester(context.Background(), &identity.StaticRequester{Namespace: "stacks-1", IDToken: "user-id-token"}),
			wantSubject: "user-id-token",
			wantNS:      "stacks-1",
		},
		{
			// A service identity has no token, so Grafana's own service token is used.
			name:   "service identity uses Grafana's token",
			ctx:    identity.WithServiceIdentityContext(context.Background(), 1),
			wantNS: "stacks-1",
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			exchanged = nil
			inner := &recordingClientV3{}
			client, err := WithAuthentication(inner, "example-app", exchanger)
			require.NoError(t, err)

			_, err = client.CallRoute(tt.ctx, pluginv3.CallRouteRequest_builder{Group: new("example.grafana.app"), Namespace: new("stacks-1")}.Build())
			require.NoError(t, err)

			require.Len(t, exchanged, 1)
			require.Equal(t, []any{"example-app"}, exchanged[0]["audiences"], "the plugin ID is the audience")
			require.Equal(t, tt.wantNS, exchanged[0]["namespace"])
			require.Equal(t, tt.wantSubject, exchanged[0]["subjectToken"])

			md, _ := metadata.FromOutgoingContext(inner.ctx)
			require.Equal(t, []string{"exchanged-token"}, md.Get("x-access-token"))
		})
	}

	t.Run("caller without a signed token is rejected", func(t *testing.T) {
		exchanged = nil
		inner := &recordingClientV3{}
		client, err := WithAuthentication(inner, "example-app", exchanger)
		require.NoError(t, err)

		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{Namespace: "stacks-1"})
		_, err = client.CallRoute(ctx, pluginv3.CallRouteRequest_builder{Group: new("example.grafana.app"), Namespace: new("stacks-1")}.Build())
		require.ErrorContains(t, err, "caller access or ID token is required")
		require.Empty(t, exchanged)
		require.Nil(t, inner.ctx, "the request must not reach the plugin")
	})
}

// recordingClientV3 records the context of the last route call.
type recordingClientV3 struct {
	ctx context.Context
}

func (c *recordingClientV3) AdmissionReview(context.Context, *pluginv3.AdmissionReviewRequest) (*pluginv3.AdmissionReviewResponse, error) {
	return &pluginv3.AdmissionReviewResponse{}, nil
}

func (c *recordingClientV3) CallRoute(ctx context.Context, _ *pluginv3.CallRouteRequest) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
	c.ctx = ctx
	return nil, nil
}

func (c *recordingClientV3) ConvertObjects(context.Context, *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
	return &pluginv3.ConvertObjectsResponse{}, nil
}
