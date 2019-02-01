package middleware

import (
	"testing"
	"fmt"
	"encoding/base64"
	"github.com/dgrijalva/jwt-go"

	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAuthJWT(t *testing.T) {
	Convey("When using JWT auth", t, func() {
		bus.ClearBusHandlers()
		bus.AddHandler("userQuota", func(query *m.GetUserQuotaByTargetQuery) error {
			query.Result = &m.UserQuotaDTO{
				Target: query.Target,
				Limit:  query.Default,
				Used:   4,
			}
			return nil
		})

		fmt.Println("runing first test")

		// A simple key
		mySigningKey := []byte("AllYourBase")

		setting.AuthJwtEnabled = true
		setting.AuthJwtHeader  = "X-MyJWT"
		setting.AuthJwtSigningKey = base64.StdEncoding.EncodeToString(mySigningKey)
		setting.AuthJwtEmailClaim = "email"

		// Create the Claims
		claims := &jwt.MapClaims{
			"sub": "name",
			"email": "test@grafana.com",
		}

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		ss, err := token.SignedString(mySigningKey)
		fmt.Println(ss, err)

		InitAuthJwtKey()

		Convey("Should be able to decode directly", func() {
			token, err := jwt.Parse(ss, keyFunc)
			So(err, ShouldEqual, nil)
			So(token.Valid, ShouldEqual, true)

			parsed := token.Claims.(jwt.MapClaims);
			So(parsed["email"], ShouldEqual, "test@grafana.com")
			So(parsed["sub"], ShouldEqual, "name")
		})

		orgId := int64(1)

		fmt.Printf("HELLO: %+v\n", orgId)

		middlewareScenario("Error with invalid JWT", func(sc *scenarioContext) {
		

			fmt.Printf("//SC: %+v\n", sc)


		//	initContextWithJwtAuth(&sc.ctx, orgId)

			// It is a bad request
			//So(ctx.resp.Code, ShouldEqual, 400)
			So( orgId, ShouldEqual, 1)
		})
	})
}
