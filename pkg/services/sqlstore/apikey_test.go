package sqlstore

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	m "github.com/grafana/grafana/pkg/models"
)

func TestApiKeyDataAccess(t *testing.T) {

	Convey("Testing API Key data access", t, func() {
		InitTestDB(t)

		Convey("Given saved api key", func() {
			cmd := m.AddApiKeyCommand{AccountId: 1, Key: "hello"}
			err := AddApiKey(&cmd)
			So(err, ShouldBeNil)

			Convey("Should be able to get key by key", func() {
				query := m.GetApiKeyByKeyQuery{Key: "hello"}
				err = GetApiKeyByKey(&query)
				So(err, ShouldBeNil)

				So(query.Result, ShouldNotBeNil)
			})

		})
	})
}
