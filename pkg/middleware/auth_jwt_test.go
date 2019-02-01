package middleware

import (
	"testing"

	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAuthJWT(t *testing.T) {
	Convey("When using JWT auth", t, func() {

		setting.AuthJwtEnabled = true
		setting.AuthJwtHeaderName  = "X-MyJWT"

		JwtAuthInit()

		orgId := int64(1)

		Convey("Error with invalid JWT", func() {
			// req.Header.Set(setting.AuthJwtHeaderName, "Not a JWT")

			ctx := m.ReqContext{}
			//ctx.Header.Set(setting.AuthJwtHeaderName, "Not a JWT")

			initContextWithJwtAuth(&ctx, orgId)

			// It is a bad request
			// So(ctx.resp.Code, ShouldEqual, 400)
		})
	})
}
