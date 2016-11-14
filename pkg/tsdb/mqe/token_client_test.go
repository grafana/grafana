package mqe

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
)

func TestTokenClient(t *testing.T) {
	SkipConvey("Token client", t, func() {
		dsInfo := &tsdb.DataSourceInfo{
			JsonData: simplejson.New(),
			Url:      "",
		}

		client := NewTokenClient()

		body, err := client.RequestTokenData(context.TODO(), dsInfo)

		So(err, ShouldBeNil)
		So(len(body.Functions), ShouldBeGreaterThan, 1)
		So(len(body.Metrics), ShouldBeGreaterThan, 1)
	})
}
