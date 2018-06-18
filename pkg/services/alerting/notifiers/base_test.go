package notifiers

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestBaseNotifier(t *testing.T) {
	Convey("Base notifier tests", t, func() {
		Convey("default constructor for notifiers", func() {
			bJson := simplejson.New()

			Convey("can parse false value", func() {
				bJson.Set("uploadImage", false)

				base := NewNotifierBase(1, false, "name", "email", bJson)
				So(base.UploadImage, ShouldBeFalse)
			})

			Convey("can parse true value", func() {
				bJson.Set("uploadImage", true)

				base := NewNotifierBase(1, false, "name", "email", bJson)
				So(base.UploadImage, ShouldBeTrue)
			})

			Convey("default value should be true for backwards compatibility", func() {
				base := NewNotifierBase(1, false, "name", "email", bJson)
				So(base.UploadImage, ShouldBeTrue)
			})
		})

		Convey("should notify", func() {
			Convey("pending -> ok", func() {
				context := alerting.NewEvalContext(context.TODO(), &alerting.Rule{
					State: m.AlertStatePending,
				})
				context.Rule.State = m.AlertStateOK
				So(defaultShouldNotify(context), ShouldBeFalse)
			})

			Convey("ok -> alerting", func() {
				context := alerting.NewEvalContext(context.TODO(), &alerting.Rule{
					State: m.AlertStateOK,
				})
				context.Rule.State = m.AlertStateAlerting
				So(defaultShouldNotify(context), ShouldBeTrue)
			})
		})
	})
}
