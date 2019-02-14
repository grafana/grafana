package util

import (
	"fmt"
	. "github.com/smartystreets/goconvey/convey"
	"testing"

	"os"
)

func TestJWTUtils(t *testing.T) {
	pwd, err := os.Getwd()
	if err != nil {
		t.Fatal("Unable to get working directory", err)
	}

	Convey("Test reading google JWK", t, func() {
		decoder, err := NewJWTDecoder(pwd + "/jwt_test_data.google.json")
		So(err, ShouldBeNil)
		So(decoder, ShouldNotBeNil)

		So(1, ShouldEqual, 1)
	})

	Convey("Test reading firebase Registry", t, func() {
		decoder, err := NewJWTDecoder(pwd + "/jwt_test_data.firebase.json")
		So(err, ShouldBeNil)
		So(decoder, ShouldNotBeNil)

		// Expired token (using kid=97fcbca368fe77808830c8100121ec7bde22cf0e)
		txt := "eyJhbGciOiJSUzI1NiIsImtpZCI6Ijk3ZmNiY2EzNjhmZTc3ODA4ODMwYzgxMDAxMjFlYzdiZGUyMmNmMGUiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vbW9uaXRyb24tZGV2IiwibmFtZSI6IlJ5YW4gTWNLaW5sZXkiLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDYuZ29vZ2xldXNlcmNvbnRlbnQuY29tLy1WVVZEODZxRzZkQS9BQUFBQUFBQUFBSS9BQUFBQUFBQUFCRS9JV1VfbXdBdV9HSS9waG90by5qcGciLCJhdWQiOiJtb25pdHJvbi1kZXYiLCJhdXRoX3RpbWUiOjE1NDM0MzkyMTcsInVzZXJfaWQiOiJ3SDJXelhOS0dHUnRaZzl5bVRlS0tYbTlOaGIyIiwic3ViIjoid0gyV3pYTktHR1J0Wmc5eW1UZUtLWG05TmhiMiIsImlhdCI6MTU1MDAxNDg2MiwiZXhwIjoxNTUwMDE4NDYyLCJlbWFpbCI6InJ5YW5AbmF0ZWxlbmVyZ3kuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZ29vZ2xlLmNvbSI6WyIxMDg0NzkxMjI2MjIxNjMzOTU5NTgiXSwiZW1haWwiOlsicnlhbkBuYXRlbGVuZXJneS5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.Yil2QL1leIITBJIS4m8-SDdgMSv6oIvp5gPZqAvYSAzShkGauIAcmaSG0CRh4AzjdqaLafpw7_t9ihADTV-h7HPXJjzxBWS9HQ1ZW8ndOSTGl9FDYn2CC0jrFjWjqip4HVKQr88tt8idYMGk-eThNfGl3AmJw-AUvj-zMfxbQCGM6Kskj5kYvmsHy2UL5aeM8VNPQF19BBIfquSP8nrv12G79ntdrh60ikosw8Vi7lG-LuFC2XLJzgH0_Z7dHPH8fH-51HQHYgcxJ0-Zt7mXmOWcinqp2UPS0ZeUmMEwHQkA_5gB9_ZT900e5LRz5d3N95FqbZrJh0p5qSnU8WSwtg"

		key, err := decoder.Decode(txt)

		fmt.Printf("FIREBASE: %+v\n", key)
		So(key, ShouldNotBeNil)

		So(1, ShouldEqual, 1)
	})
}
