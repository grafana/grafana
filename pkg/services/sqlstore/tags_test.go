// +build integration

package sqlstore

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestSavingTags(t *testing.T) {
	Convey("Testing tags saving", t, func() {
		InitTestDB(t)

		tagPairs := []*models.Tag{
			{Key: "outage"},
			{Key: "type", Value: "outage"},
			{Key: "server", Value: "server-1"},
			{Key: "error"},
		}
		tags, err := EnsureTagsExist(newSession(context.Background()), tagPairs)

		So(err, ShouldBeNil)
		So(len(tags), ShouldEqual, 4)
	})
}
