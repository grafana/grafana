package api

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/macaron.v1"
)

func TestBasicAuthenticatedRequest(t *testing.T) {
	expectedUser := "prometheus"
	expectedPass := "password"

	Convey("Given a valid set of basic auth credentials", t, func() {
		httpReq, err := http.NewRequest("GET", "http://localhost:3000/metrics", nil)
		So(err, ShouldBeNil)
		req := macaron.Request{
			Request: httpReq,
		}
		encodedCreds := encodeBasicAuthCredentials(expectedUser, expectedPass)
		req.Header.Add("Authorization", fmt.Sprintf("Basic %s", encodedCreds))
		authenticated := BasicAuthenticatedRequest(req, expectedUser, expectedPass)
		So(authenticated, ShouldBeTrue)
	})

	Convey("Given an invalid set of basic auth credentials", t, func() {
		httpReq, err := http.NewRequest("GET", "http://localhost:3000/metrics", nil)
		So(err, ShouldBeNil)
		req := macaron.Request{
			Request: httpReq,
		}
		encodedCreds := encodeBasicAuthCredentials("invaliduser", "invalidpass")
		req.Header.Add("Authorization", fmt.Sprintf("Basic %s", encodedCreds))
		authenticated := BasicAuthenticatedRequest(req, expectedUser, expectedPass)
		So(authenticated, ShouldBeFalse)
	})
}

func encodeBasicAuthCredentials(user, pass string) string {
	creds := fmt.Sprintf("%s:%s", user, pass)
	return base64.StdEncoding.EncodeToString([]byte(creds))
}
