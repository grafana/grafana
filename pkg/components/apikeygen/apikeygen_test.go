package apikeygen

import (
	"testing"

	"github.com/grafana/grafana/pkg/util"
	. "github.com/smartystreets/goconvey/convey"
)

func TestApiKeyGen(t *testing.T) {

	Convey("When generating new api key", t, func() {
		result, err := New(12, "Cool key")
		So(err, ShouldBeNil)

		So(result.ClientSecret, ShouldNotBeEmpty)
		So(result.HashedKey, ShouldNotBeEmpty)

		Convey("can decode key", func() {
			keyInfo, err := Decode(result.ClientSecret)
			So(err, ShouldBeNil)

			keyHashed, err := util.EncodePassword(keyInfo.Key, keyInfo.Name)
			So(err, ShouldBeNil)
			So(keyHashed, ShouldEqual, result.HashedKey)
		})
	})
}
