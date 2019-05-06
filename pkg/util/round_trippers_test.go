package util

import (
	. "github.com/smartystreets/goconvey/convey"
	"net/http"
	"testing"
)

type mockRoundTripper struct {
	request  *http.Request
	response *http.Response
	err      error
}

func (m *mockRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	m.request = req
	return m.response, m.err
}

func TestRoundTrippers(t *testing.T) {
	Convey("Given a basic auth round tripper", t, func() {
		rt := &mockRoundTripper{}
		req := &http.Request{}

		Convey("Given that a password file was specified", func() {
			NewBasicAuthRoundTripper("testuser", "", "testdata/secretfile", rt).RoundTrip(req)

			actualUser, actualPass, ok := rt.request.BasicAuth()
			So(ok, ShouldBeTrue)
			So(actualUser, ShouldEqual, "testuser")
			So(actualPass, ShouldEqual, "secretvalue")
		})

		Convey("Given that a password was specified directly", func() {
			NewBasicAuthRoundTripper("testuser", "secretvalue", "", rt).RoundTrip(req)

			actualUser, actualPass, ok := rt.request.BasicAuth()
			So(ok, ShouldBeTrue)
			So(actualUser, ShouldEqual, "testuser")
			So(actualPass, ShouldEqual, "secretvalue")
		})
	})

	Convey("Given a bearer token round tripper", t, func() {
		rt := &mockRoundTripper{}
		req := &http.Request{}

		Convey("Given that a bearer token file was specified", func() {
			NewBearerAuthRoundTripper("testdata/secretfile", rt).RoundTrip(req)

			actualToken := rt.request.Header.Get("Authorization")
			So(actualToken, ShouldEqual, "Bearer secretvalue")
		})
	})

	Convey("Given multiple round trippers used for authentication", t, func() {
		rt := &mockRoundTripper{}
		req := &http.Request{}

		NewBasicAuthRoundTripper("testuser", "", "testdata/secretfile", rt).RoundTrip(req)
		NewBearerAuthRoundTripper("testdata/secretfile", rt).RoundTrip(req)

		actualToken := rt.request.Header.Get("Authorization")
		So(actualToken, ShouldEqual, "Bearer secretvalue")
	})
}
