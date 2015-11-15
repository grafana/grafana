package sqlstore

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	m "github.com/wangy1931/grafana/pkg/models"
)

func TestApiKeyDataAccess(t *testing.T) {

	Convey("Testing API Key data access", t, func() {
		InitTestDB(t)

		Convey("Given saved api key", func() {
			cmd := m.AddApiKeyCommand{OrgId: 1, Name: "hello", Key: "asd"}
			err := AddApiKey(&cmd)
			So(err, ShouldBeNil)

			Convey("Should be able to get key by name", func() {
				query := m.GetApiKeyByNameQuery{KeyName: "hello", OrgId: 1}
				err = GetApiKeyByName(&query)

				So(err, ShouldBeNil)
				So(query.Result, ShouldNotBeNil)
			})

		})
	})
}
