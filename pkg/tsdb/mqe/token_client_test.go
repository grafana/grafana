package mqe

import (
	"context"
	"testing"

	"net/http"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestTokenClient(t *testing.T) {
	SkipConvey("Token client", t, func() {
		dsInfo := &models.DataSource{
			JsonData: simplejson.New(),
			Url:      "",
		}

		client := NewTokenClient(http.DefaultClient)

		body, err := client.RequestTokenData(context.TODO(), dsInfo)

		So(err, ShouldBeNil)
		//So(len(body.Functions), ShouldBeGreaterThan, 1)
		So(len(body.Metrics), ShouldBeGreaterThan, 1)
	})
}
