package middleware

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSubPathRedirect(t *testing.T) {
	testSubPathRedirect(t, "/", "http://localhost:3000/subpath/")
	testSubPathRedirect(t, "/admin/my/page", "http://localhost:3000/subpath/admin/my/page")
	testSubPathRedirect(t, "/api/users", "")
}

func testSubPathRedirect(t *testing.T, url string, expectedRedirect string) {
	middlewareScenario(t, "GET url without subpath", func(t *testing.T, sc *scenarioContext) {
		sc.cfg.AppSubURL = "/subpath"
		sc.cfg.AppURL = "http://localhost:3000/subpath/"

		sc.m.UseMiddleware(SubPathRedirect(sc.cfg))
		sc.m.Get("/api/users", sc.defaultHandler)

		sc.fakeReqWithParams("GET", url, map[string]string{}).exec()

		if expectedRedirect != "" {
			assert.Equal(t, 301, sc.resp.Code)

			// nolint:bodyclose
			resp := sc.resp.Result()
			t.Cleanup(func() {
				err := resp.Body.Close()
				assert.NoError(t, err)
			})
			redirectURL, err := resp.Location()
			require.NoError(t, err)

			assert.Equal(t, expectedRedirect, redirectURL.String())
		} else {
			assert.Equal(t, 200, sc.resp.Code)
		}
	})
}
