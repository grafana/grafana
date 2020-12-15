package notifiers

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestWhenMatrixShouldNotify(t *testing.T) {
	tcs := []struct {
		prevState models.AlertStateType
		newState  models.AlertStateType

		expect bool
	}{
		{
			prevState: models.AlertStatePending,
			newState:  models.AlertStateOK,
			expect:    false,
		},
		{
			prevState: models.AlertStateAlerting,
			newState:  models.AlertStateOK,
			expect:    true,
		},
		{
			prevState: models.AlertStateOK,
			newState:  models.AlertStatePending,
			expect:    false,
		},
		{
			prevState: models.AlertStateUnknown,
			newState:  models.AlertStatePending,
			expect:    false,
		},
	}

	for _, tc := range tcs {
		am := &AlertmanagerNotifier{log: log.New("test.logger")}
		evalContext := alerting.NewEvalContext(context.Background(), &alerting.Rule{
			State: tc.prevState,
		})

		evalContext.Rule.State = tc.newState

		res := am.ShouldNotify(context.TODO(), evalContext, &models.AlertNotificationState{})
		if res != tc.expect {
			t.Errorf("got %v expected %v", res, tc.expect)
		}
	}
}

func TestMatrixNotifier(t *testing.T) {
	Convey("Matrix notifier tests", t, func() {
		Convey("Parsing alert notification from settings", func() {
			Convey("empty settings should return error", func() {
				json := `{ }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "Matrix",
					Type:     "matrix",
					Settings: settingsJSON,
				}

				_, err := NewMatrixNotifier(model)
				So(err, ShouldNotBeNil)
			})

			Convey("from settings", func() {
				json := `{ "homeserverUrl": "https://matrix.org:8448", "accessToken": "ToKeN", "recipient": "!roomid:homeservername" }`

				settingsJSON, _ := simplejson.NewJson([]byte(json))
				model := &models.AlertNotification{
					Name:     "Matrix",
					Type:     "matrix",
					Settings: settingsJSON,
				}

				not, err := NewMatrixNotifier(model)
				matrixNotifier := not.(*MatrixNotifier)

				So(err, ShouldBeNil)
				So(matrixNotifier.HomeserverURL, ShouldEqual, "https://matrix.org:8448")
				So(matrixNotifier.AccessToken, ShouldEqual, "ToKeN")
				So(matrixNotifier.Recipient, ShouldResemble, "!roomid:homeservername")
			})

		})
	})
}
