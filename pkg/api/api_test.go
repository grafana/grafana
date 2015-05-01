package api

import (
	"testing"
)

func TestHttpApi(t *testing.T) {

	// Convey("Given the grafana api", t, func() {
	// 	ConveyApiScenario("Can sign up", func(c apiTestContext) {
	// 		c.PostJson()
	// 		So(c.Resp, ShouldEqualJsonApiResponse, "User created and logged in")
	// 	})
	//
	// 	m := macaron.New()
	// 	m.Use(middleware.GetContextHandler())
	// 	m.Use(middleware.Sessioner(&session.Options{}))
	// 	Register(m)
	//
	// 	var context *middleware.Context
	// 	m.Get("/", func(c *middleware.Context) {
	// 		context = c
	// 	})
	//
	// 	resp := httptest.NewRecorder()
	// 	req, err := http.NewRequest("GET", "/", nil)
	// 	So(err, ShouldBeNil)
	//
	// 	m.ServeHTTP(resp, req)
	//
	// 	Convey("should red 200", func() {
	// 		So(resp.Code, ShouldEqual, 200)
	// 	})
	// })
}
