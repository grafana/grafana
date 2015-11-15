package apikeygen

import (
	"testing"

	"github.com/wangy1931/grafana/pkg/util"
	. "github.com/smartystreets/goconvey/convey"
)

func TestApiKeyGen(t *testing.T) {

	Convey("When generating new api key", t, func() {
		result := New(12, "Cool key")

		So(result.ClientSecret, ShouldNotBeEmpty)
		So(result.HashedKey, ShouldNotBeEmpty)

		Convey("can decode key", func() {
			keyInfo, err := Decode(result.ClientSecret)
			So(err, ShouldBeNil)

			keyHashed := util.EncodePassword(keyInfo.Key, keyInfo.Name)
			So(keyHashed, ShouldEqual, result.HashedKey)
		})
	})
}
