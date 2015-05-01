package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Unknwon/macaron"
	"github.com/macaron-contrib/session"
	. "github.com/smartystreets/goconvey/convey"
)

func TestMiddlewareContext(t *testing.T) {

	Convey("Given grafana context", t, func() {
		m := macaron.New()
		m.Use(GetContextHandler())
		m.Use(Sessioner(&session.Options{}))

		var context *Context

		m.Get("/", func(c *Context) {
			context = c
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/", nil)
		So(err, ShouldBeNil)

		m.ServeHTTP(resp, req)

		Convey("Should be able to get grafana context in handlers", func() {
			So(context, ShouldNotBeNil)
		})

		Convey("should return 200", func() {
			So(resp.Code, ShouldEqual, 200)
		})
	})
}
