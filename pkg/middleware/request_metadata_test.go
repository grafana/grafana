package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/assert"
)

func TestRequestMetaDefault(t *testing.T) {
	m := web.New()
	m.Use(requestmeta.SetupRequestMetadata())

	m.Get("/", func(rw http.ResponseWriter, req *http.Request) {
		v := requestmeta.GetRequestMetaData(req.Context())
		assert.Equal(t, requestmeta.TeamCore, v.Team)
	})

	req, _ := http.NewRequest(http.MethodGet, "/", nil)
	m.ServeHTTP(httptest.NewRecorder(), req)
}

func TestRequestMetaNewTeam(t *testing.T) {
	m := web.New()
	m.Use(requestmeta.SetupRequestMetadata())

	m.Get("/",
		requestmeta.SetOwner(requestmeta.TeamAlerting), // set new owner for this route.
		func(rw http.ResponseWriter, req *http.Request) {
			v := requestmeta.GetRequestMetaData(req.Context())
			assert.Equal(t, requestmeta.TeamAlerting, v.Team)
		})

	r, err := http.NewRequest(http.MethodGet, "/", nil)
	assert.NoError(t, err)
	m.ServeHTTP(httptest.NewRecorder(), r)
}
