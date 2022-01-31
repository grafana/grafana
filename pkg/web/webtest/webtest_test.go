package webtest

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestServerClient(t *testing.T) {
	routeRegister := routing.NewRouteRegister()
	routeRegister.Get("/test", routing.Wrap(func(c *models.ReqContext) response.Response {
		return response.JSON(http.StatusOK, c.SignedInUser)
	}))

	s := NewServer(t, routeRegister)

	t.Run("Making a request with user 1 should return user 1 as signed in user", func(t *testing.T) {
		req := s.NewRequest(http.MethodGet, "/test", nil)
		req = RequestWithWebContext(req, &models.ReqContext{
			SignedInUser: &models.SignedInUser{
				UserId: 1,
			},
		})
		resp, err := s.Send(req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		bytes, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())

		var user *models.SignedInUser
		err = json.Unmarshal(bytes, &user)
		require.NoError(t, err)
		require.NotNil(t, user)
		require.Equal(t, int64(1), user.UserId)
	})

	t.Run("Making a request with user 2 should return user 2 as signed in user", func(t *testing.T) {
		req := s.NewRequest(http.MethodGet, "/test", nil)
		req = RequestWithWebContext(req, &models.ReqContext{
			SignedInUser: &models.SignedInUser{
				UserId: 2,
			},
		})
		resp, err := s.Send(req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		bytes, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())

		var user *models.SignedInUser
		err = json.Unmarshal(bytes, &user)
		require.NoError(t, err)
		require.NotNil(t, user)
		require.Equal(t, int64(2), user.UserId)
	})
}
