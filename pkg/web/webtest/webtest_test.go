package webtest

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestServer(t *testing.T) {
	routeRegister := routing.NewRouteRegister()
	var actualRequest *http.Request
	routeRegister.Post("/api", routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
		actualRequest = c.Req
		return response.JSON(http.StatusOK, c.SignedInUser)
	}))
	s := NewServer(t, routeRegister)
	require.NotNil(t, s)

	t.Run("NewRequest: GET api should set expected properties", func(t *testing.T) {
		req := s.NewRequest(http.MethodGet, "api", nil)
		verifyRequest(t, s, req, "")
	})

	t.Run("NewGetRequest: GET /api should set expected properties", func(t *testing.T) {
		req := s.NewGetRequest("/api")
		verifyRequest(t, s, req, "")
	})

	t.Run("NewPostRequest: POST api should set expected properties", func(t *testing.T) {
		payload := strings.NewReader("test")
		req := s.NewPostRequest("api", payload)
		verifyRequest(t, s, req, "test")

		t.Run("SendJSON should set expected Content-Type header", func(t *testing.T) {
			payload.Reset("test")
			resp, err := s.SendJSON(req)
			require.NoError(t, err)
			require.NotNil(t, resp)
			require.NoError(t, resp.Body.Close())
			require.NotNil(t, actualRequest)
			require.Equal(t, "application/json", actualRequest.Header.Get("Content-Type"))
		})
	})
}

func verifyRequest(t *testing.T, s *Server, req *http.Request, expectedBody string) {
	require.NotNil(t, req)
	require.Equal(t, s.TestServer.URL+"/api", req.URL.String())

	if expectedBody == "" {
		require.Equal(t, http.MethodGet, req.Method)
		require.Equal(t, http.NoBody, req.Body)
	} else {
		require.Equal(t, http.MethodPost, req.Method)
		require.NotNil(t, req.Body)
		bytes, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		require.Equal(t, expectedBody, string(bytes))
	}

	require.NotEmpty(t, requestIdentifierFromRequest(req))

	req = RequestWithWebContext(req, &contextmodel.ReqContext{
		IsSignedIn: true,
	})
	require.NotNil(t, req)
	ctx := requestContextFromRequest(req)
	require.NotNil(t, ctx)
	require.True(t, ctx.IsSignedIn)
}

func TestServerClient(t *testing.T) {
	routeRegister := routing.NewRouteRegister()
	routeRegister.Get("/test", routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
		return response.JSON(http.StatusOK, c.SignedInUser)
	}))

	s := NewServer(t, routeRegister)

	t.Run("Making a request with user 1 should return user 1 as signed in user", func(t *testing.T) {
		req := s.NewRequest(http.MethodGet, "/test", nil)
		req = RequestWithWebContext(req, &contextmodel.ReqContext{
			SignedInUser: &user.SignedInUser{
				UserID: 1,
			},
		})
		resp, err := s.Send(req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		bytes, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())

		var user user.SignedInUser
		err = json.Unmarshal(bytes, &user)
		require.NoError(t, err)
		require.NotNil(t, user)
		require.Equal(t, int64(1), user.UserID)
	})

	t.Run("Making a request with user 2 should return user 2 as signed in user", func(t *testing.T) {
		req := s.NewRequest(http.MethodGet, "/test", nil)
		req = RequestWithWebContext(req, &contextmodel.ReqContext{
			SignedInUser: &user.SignedInUser{
				UserID: 2,
			},
		})
		resp, err := s.Send(req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		bytes, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())

		var user user.SignedInUser
		err = json.Unmarshal(bytes, &user)
		require.NoError(t, err)
		require.NotNil(t, user)
		require.Equal(t, int64(2), user.UserID)
	})
}
