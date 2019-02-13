package middleware

import (
	"testing"

	macaron "gopkg.in/macaron.v1"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

// Capture output from an internal render
type CaptureRender struct {
	macaron.DummyRender

	status int
	body   interface{}
}

func (r *CaptureRender) JSON(s int, b interface{}) {
	r.status = s
	r.body = b
}

func TestAuthJWT(t *testing.T) {
	Convey("When using JWT auth", t, func() {

		orgId := int64(1)
		bus.ClearBusHandlers()
		bus.AddHandler("test", func(query *m.GetSignedInUserQuery) error {
			query.Result = &m.SignedInUser{
				OrgId:  query.OrgId,
				UserId: 123,
				Email:  query.Email,
			}
			return nil
		})

		// A simple key
		mySigningKey := []byte("AllYourBase")
		setting.AuthJwtEnabled = true
		setting.AuthJwtHeader = "X-MyJWT"
		setting.AuthJwtSigningKey = base64.StdEncoding.EncodeToString(mySigningKey)
		setting.AuthJwtEmailClaim = "email"
		InitAuthJwtKey()

		// Create the Claims
		claims := &jwt.MapClaims{
			"sub":   "name",
			"email": "test@grafana.com",
		}

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		signed, err := token.SignedString(mySigningKey)
		So(err, ShouldEqual, nil)

		Convey("Should be able to decode JWT directly", func() {
			token, err := jwt.Parse(signed, keyFunc)
			So(err, ShouldEqual, nil)
			So(token.Valid, ShouldEqual, true)

			parsed := token.Claims.(jwt.MapClaims)
			So(parsed["email"], ShouldEqual, "test@grafana.com")
			So(parsed["sub"], ShouldEqual, "name")
		})

		Convey("Context should read it from header and find a user", func() {
			httpreq := &http.Request{Header: make(http.Header)}
			httpreq.Header.Add(setting.AuthJwtHeader, signed)
			render := &CaptureRender{}

			ctx := &m.ReqContext{Context: &macaron.Context{
				Req:    macaron.Request{Request: httpreq},
				Render: render,
			},
				Logger: log.New("fakelogger"),
			}

			initContextWithJwtAuth(ctx, orgId)
			So(ctx.SignedInUser, ShouldNotBeNil)
		})

		Convey("Context should throw an error with invalid JWTs", func() {
			httpreq := &http.Request{Header: make(http.Header)}
			httpreq.Header.Add(setting.AuthJwtHeader, "NOT-A-JWT")
			render := &CaptureRender{}
			ctx := &m.ReqContext{Context: &macaron.Context{
				Req:    macaron.Request{Request: httpreq},
				Render: render,
			},
				Logger: log.New("fakelogger"),
			}

			initContextWithJwtAuth(ctx, orgId)
			So(ctx.SignedInUser, ShouldBeNil)
			So(render.status, ShouldEqual, 400)
		})

		// Check Firebase Support
		Convey("Should parse firebase tokens", func() {

			setting.AuthJwtSigningKey = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
			setting.AuthJwtIssuer = "https://securetoken.google.com/safetronx"
			InitAuthJwtKey()
			So(keyFunc, ShouldNotBeNil)

			// Expired token
			fbjwt := "eyJhbGciOiJSUzI1NiIsImtpZCI6Ijg1OWE2NDFhMWI4MmNjM2I1MGE4MDFiZjUwNjQwZjM4MjU3ZDEyOTkiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vc2FmZXRyb254IiwibmFtZSI6IlJ5YW4gTWNLaW5sZXkiLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDUuZ29vZ2xldXNlcmNvbnRlbnQuY29tLy12M0diUy1namhlcy9BQUFBQUFBQUFBSS9BQUFBQUFBQUNIZy94ZE5VbDRmMUdEZy9waG90by5qcGciLCJhdWQiOiJzYWZldHJvbngiLCJhdXRoX3RpbWUiOjE1NDkwNDIzNzUsInVzZXJfaWQiOiJyalNaZm9LYnZYU1pyRGg3SUVmOGRid0Mxa2kxIiwic3ViIjoicmpTWmZvS2J2WFNackRoN0lFZjhkYndDMWtpMSIsImlhdCI6MTU0OTA0MjM3NSwiZXhwIjoxNTQ5MDQ1OTc1LCJlbWFpbCI6InJ5YW50eHVAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZ29vZ2xlLmNvbSI6WyIxMDM3Nzg4NDE3Nzk5OTQ4ODI1MTIiXSwiZW1haWwiOlsicnlhbnR4dUBnbWFpbC5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJnb29nbGUuY29tIn19.YPgqDMZAXUQPPR3ofDBl4vIK1amQQLsmo9OQvM0v9f98hDWcwVIPBh34CWFum40DA-H6JDqiGMbqcPl8LPUewRU01GdbR1QV7FvL_n2UQOLSJWcRnyi-LBK2TtkQ6fRpNNrX-E3lwgNq_GnegkEW1NZnPqpLZsN67kflGh5c7tC45v0osvFT-X8LjWxww4PijoZZsTdF2GRkuRYGLWQ1v99dhr9y8QhXHtTiHS6D9bjZ53K7t8CBKiZ5Ibkr4wZhz5-mW-6PibzTX-u2JeIzQFZo9tQM7-T526oVU19d7O-P5PU_kNmHe99PyDt2drtBbUPNn9IeenvIrz6rOKau6g"

			token, err := jwt.Parse(fbjwt, keyFunc)
			So(token.Valid, ShouldEqual, false)
			So(err.Error(), ShouldEqual, "Token is expired")

			// We can parse it anyway
			parsed := token.Claims.(jwt.MapClaims)
			So(parsed["email"], ShouldEqual, "ryantxu@gmail.com")
			So(parsed["email_verified"], ShouldBeTrue)
			// fmt.Printf("FIREBASE: %+v\n", parsed)

			// This should give an exception since it is expired
			httpreq := &http.Request{Header: make(http.Header)}
			httpreq.Header.Add(setting.AuthJwtHeader, fbjwt)
			render := &CaptureRender{}
			ctx := &m.ReqContext{Context: &macaron.Context{
				Req:    macaron.Request{Request: httpreq},
				Render: render,
			},
				Logger: log.New("fakelogger"),
			}
			initContextWithJwtAuth(ctx, orgId)
			So(ctx.SignedInUser, ShouldBeNil)
			So(render.status, ShouldEqual, 400)
		})

		// Check Google JWK/IAP Support
		Convey("Should parse JWK tokens", func() {
			setting.AuthJwtSigningKey = "https://www.gstatic.com/iap/verify/public_key-jwk"
			setting.AuthJwtIssuer = ""
			InitAuthJwtKey()

			// NOT YET SUPPORTED!
			So(keyFunc, ShouldBeNil)
		})
	})
}
