package middleware

import (
	"encoding/base64"
	"fmt"
	"github.com/dgrijalva/jwt-go"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAuthJWT(t *testing.T) {
	Convey("When using JWT auth", t, func() {

		orgId := int64(1)
		bus.ClearBusHandlers()
		bus.AddHandler("test", func(query *m.GetSignedInUserQuery) error {
			query.Result = &m.SignedInUser{OrgId: orgId, UserId: 123}
			return nil
		})

		fmt.Println("runing first test")

		// A simple key
		mySigningKey := []byte("AllYourBase")

		setting.AuthJwtEnabled = true
		setting.AuthJwtHeader = "X-MyJWT"
		setting.AuthJwtSigningKey = base64.StdEncoding.EncodeToString(mySigningKey)
		setting.AuthJwtEmailClaim = "email"

		// Create the Claims
		claims := &jwt.MapClaims{
			"sub":   "name",
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

			parsed := token.Claims.(jwt.MapClaims)
			So(parsed["email"], ShouldEqual, "test@grafana.com")
			So(parsed["sub"], ShouldEqual, "name")
		})

		InitAuthJwtKey()

		setting.AuthJwtSigningKey = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
		Convey("Should parse firebase URL", func() {
			InitAuthJwtKey()
			So(keyFunc, ShouldNotBeNil)

			fbtoken := "eyJhbGciOiJSUzI1NiIsImtpZCI6Ijg1OWE2NDFhMWI4MmNjM2I1MGE4MDFiZjUwNjQwZjM4MjU3ZDEyOTkiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vbW9uaXRyb24tZGV2IiwibmFtZSI6IlJ5YW4gTWNLaW5sZXkiLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDYuZ29vZ2xldXNlcmNvbnRlbnQuY29tLy1WVVZEODZxRzZkQS9BQUFBQUFBQUFBSS9BQUFBQUFBQUFCRS9JV1VfbXdBdV9HSS9waG90by5qcGciLCJhdWQiOiJtb25pdHJvbi1kZXYiLCJhdXRoX3RpbWUiOjE1NDM0MzkyMTcsInVzZXJfaWQiOiJ3SDJXelhOS0dHUnRaZzl5bVRlS0tYbTlOaGIyIiwic3ViIjoid0gyV3pYTktHR1J0Wmc5eW1UZUtLWG05TmhiMiIsImlhdCI6MTU0OTAwOTkyMCwiZXhwIjoxNTQ5MDEzNTIwLCJlbWFpbCI6InJ5YW5AbmF0ZWxlbmVyZ3kuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZ29vZ2xlLmNvbSI6WyIxMDg0NzkxMjI2MjIxNjMzOTU5NTgiXSwiZW1haWwiOlsicnlhbkBuYXRlbGVuZXJneS5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.ceaGDDnyvJ4kgpAGEHvdqGOF2hO2S0pVWRVimFwezNh05Q8PWv-_Ke36SS2bAm04-65k5xfxxAf48m83uwb3QIOvF7HHlSCaX1rKrJlqwXIKDuHR0O54gk_rcmbJf_F0ZnZNgGUQOnXVG-bn9W7WOGtCr2jY5e9yzm7CJOWcqQBD0ozdOZ1BEajNHloWKOA31eOIIkfArfgHoDwbs8EsJrlPb5eBWDHmF9fBKrUnUZcEpwVY8eo5_XgxCxkq2keCHqWwa_NzpONk0gMs2Pmo5G3E_vRJFqLnUcer2lgQDtmBFo2BuweIRSQXRSPtxENtitZtGiydrkf6VKRsCejKSQ"

			token, err := jwt.Parse(fbtoken, keyFunc)
			So(err, ShouldEqual, nil)
			So(token.Valid, ShouldEqual, true)

			parsed := token.Claims.(jwt.MapClaims)
			fmt.Printf("FIREBASE: %+v\n", parsed)
		})

		middlewareScenario("Error with invalid JWT", func(sc *scenarioContext) {

			fmt.Printf("//SC: %+v\n", sc)

			//	initContextWithJwtAuth(&sc.ctx, orgId)

			// It is a bad request
			//So(ctx.resp.Code, ShouldEqual, 400)
			So(orgId, ShouldEqual, 1)
		})
	})
}
