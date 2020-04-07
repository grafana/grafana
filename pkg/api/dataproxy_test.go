package api

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestDataProxy(t *testing.T) {
	Convey("Data proxy test", t, func() {
		Convey("Should append trailing slash to proxy path if original path has a trailing slash", func() {
			So(ensureProxyPathTrailingSlash("/api/datasources/proxy/6/api/v1/query_range/", "api/v1/query_range/"), ShouldEqual, "api/v1/query_range/")
		})

		Convey("Should not append trailing slash to proxy path if original path doesn't have a trailing slash", func() {
			So(ensureProxyPathTrailingSlash("/api/datasources/proxy/6/api/v1/query_range", "api/v1/query_range"), ShouldEqual, "api/v1/query_range")
		})
	})
}
